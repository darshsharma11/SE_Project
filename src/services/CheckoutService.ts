import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { trace } from "@/lib/trace";
import { eventBus } from "@/lib/events";
import { PaymentService, CardDetails } from "./PaymentService";
import { PricingEngine } from "@/domain/PricingEngine";
import { Order, OrderStatus } from "@/domain/Order";
import { OrderItem } from "@/domain/OrderItem";
import { InventoryItem } from "@/domain/InventoryItem";
import { Product } from "@/domain/Product";
import { deliveryService } from "./DeliveryService";
import { notificationService } from "./NotificationService";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";

export interface CheckoutParams {
  customerId: number;
  paymentMethod: "CARD" | "UPI" | "WALLET";
  cardDetails?: CardDetails;
  upiId?: string;
  walletName?: string;
  confirmPriceChanges?: boolean;
  correlationId?: string;
  simulateFailure?: boolean;
}

export interface PriceChangedItem {
  productId: number;
  name: string;
  oldPrice: number;
  newPrice: number;
}

export interface CheckoutResult {
  success: boolean;
  correlationId: string;
  priceChanged?: boolean;
  priceChangedItems?: PriceChangedItem[];
  productUnavailable?: boolean;
  stockUnavailable?: boolean;
  error?: string;
  orders?: any[];
  payment?: any;
}

export class CheckoutService {
  private paymentService: PaymentService;
  private pricingEngine: PricingEngine;

  constructor(paymentService?: PaymentService, pricingEngine?: PricingEngine) {
    this.paymentService = paymentService ?? new PaymentService();
    this.pricingEngine = pricingEngine ?? new PricingEngine();
  }

  /**
   * Sequence Steps 20 through 31, and failure branches 41 through 48.
   * 20 checkout()                            Customer -> CheckoutService
   * 21 createOrder()                         ShoppingCart -> Order
   * 22 orderCreated                          Order -> CheckoutService
   * 23 reserveStock(quantity)                Order -> InventoryItem
   * 24 stockReserved                         InventoryItem -> Order
   * 25 processPayment(amount)                Order -> Payment
   * 26 authorizePayment(amount)              Payment -> PaymentGateway
   * 27 paymentSuccessful                     PaymentGateway -> Payment
   * 28 paymentConfirmed                      Payment -> Order
   * 29 updateStatus("Confirmed")             Order -> Order
   * 30 reduceStock(quantity)                 Order -> InventoryItem
   * 31 inventoryUpdated                      InventoryItem -> Order
   * Failure branches:
   * 41/42 paymentFailed                      PaymentGateway -> Payment -> Order
   * 43 releaseReservedStock()                Order -> InventoryItem
   * 44 stockReleased                         InventoryItem -> Order
   * 45 paymentFailed()                       Order -> Customer
   * 46 stockUnavailable                      InventoryItem -> Product
   * 47/48 productUnavailable()               Product -> ShoppingCart -> Customer
   */
  async checkout(params: CheckoutParams): Promise<CheckoutResult> {
    const correlationId =
      params.correlationId ?? trace.generateCorrelationId("checkout");
    const now = clock.now();

    // Idempotency check: prevent duplicate order creation, gateway charging, and stock deduction
    if (params.correlationId) {
      const existingOrders = await prisma.order.findMany({
        where: { correlationId: params.correlationId, customerId: params.customerId },
        include: { payment: true, items: true },
      });
      if (existingOrders.length > 0) {
        const payment = existingOrders[0]?.payment;
        if (payment && payment.status === "SUCCESSFUL") {
          return {
            success: true,
            correlationId: params.correlationId,
            orders: existingOrders,
            payment: {
              transactionId: payment.transactionId || "",
              amount: existingOrders.reduce((sum, o) => sum + o.totalAmount, 0),
              method: payment.method as any,
              status: "SUCCESSFUL",
            },
          };
        }
      }
    }

    // Step 20: Customer -> CheckoutService checkout()
    await trace.step({
      correlationId,
      stepNumber: 20,
      label: "checkout()",
      from: "Customer",
      to: "CheckoutService",
      details: {
        customerId: params.customerId,
        paymentMethod: params.paymentMethod,
        timestamp: now.toISOString(),
      },
    });

    // 1. Fetch customer's shopping cart
    const cart = await prisma.shoppingCart.findUnique({
      where: { customerId: params.customerId },
      include: {
        items: {
          include: {
            product: {
              include: {
                inventoryItem: true,
                pricingRule: true,
                store: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new Error("Cannot checkout an empty shopping cart");
    }

    // 2. Validate products: check expired, removed, price hold expiry, and stock availability
    const priceChangedItems: PriceChangedItem[] = [];

    for (const item of cart.items) {
      const product = item.product;

      // Enforce store verification
      if (product.store.status !== "VERIFIED") {
        return {
          success: false,
          correlationId,
          productUnavailable: true,
          error: `Store "${product.store.storeName}" is not verified for selling. Products from this store cannot be purchased.`,
        };
      }

      // Block products that are expired or removed
      const isExpired = product.expiryDateTime.getTime() <= now.getTime();
      const isNotActive = product.status !== "ACTIVE" && product.status !== "RESERVED";

      if (isExpired || isNotActive) {
        // Step 46: stockUnavailable
        await trace.step({
          correlationId,
          stepNumber: 46,
          label: "stockUnavailable",
          from: "InventoryItem",
          to: "Product",
          details: { productId: product.productId, isExpired, status: product.status },
        });
        // Step 47: productUnavailable()
        await trace.step({
          correlationId,
          stepNumber: 47,
          label: "productUnavailable()",
          from: "Order",
          to: "ShoppingCart",
          details: { productId: product.productId, productName: product.name },
        });
        // Step 48: productUnavailable()
        await trace.step({
          correlationId,
          stepNumber: 48,
          label: "productUnavailable()",
          from: "Marketplace",
          to: "Customer",
          details: { productId: product.productId, message: "Product has expired or been removed" },
        });

        return {
          success: false,
          correlationId,
          productUnavailable: true,
          error: `Product "${product.name}" is no longer available (it has expired or was removed). Please remove it from your cart.`,
        };
      }

      // Check 15-minute price hold expiry
      const isHoldExpired = item.priceHoldExpiresAt.getTime() <= now.getTime();
      const domainProduct = new Product({
        productId: product.productId,
        name: product.name,
        category: product.category,
        originalPrice: product.originalPrice,
        currentPrice: product.currentPrice,
        expiryDateTime: product.expiryDateTime,
        status: product.status as any,
        pricingRuleId: product.pricingRuleId ?? undefined,
        storeId: product.storeId,
        skipExpiryCheck: true,
      });

      const domainRule = product.pricingRule
        ? PricingRuleRepository.toDomain(product.pricingRule)
        : await this.pricingEngine.resolveRuleForProduct(product);

      const { price: currentEnginePrice } =
        await this.pricingEngine.calculateAuthoritativePrice(
          domainProduct,
          domainRule,
          now
        );

      if (isHoldExpired && currentEnginePrice !== item.price) {
        priceChangedItems.push({
          productId: product.productId,
          name: product.name,
          oldPrice: item.price,
          newPrice: currentEnginePrice,
        });
      }

      // Validate stock availability
      const inventory = product.inventoryItem;
      if (!inventory) {
        throw new Error(`Inventory record missing for product ${product.name}`);
      }
      const available = inventory.quantity - inventory.reservedQuantity;
      if (available < item.quantity) {
        // Step 46: stockUnavailable
        await trace.step({
          correlationId,
          stepNumber: 46,
          label: "stockUnavailable",
          from: "InventoryItem",
          to: "Product",
          details: { productId: product.productId, requested: item.quantity, available },
        });
        // Step 47: productUnavailable()
        await trace.step({
          correlationId,
          stepNumber: 47,
          label: "productUnavailable()",
          from: "Order",
          to: "ShoppingCart",
          details: { productId: product.productId },
        });
        // Step 48: productUnavailable()
        await trace.step({
          correlationId,
          stepNumber: 48,
          label: "productUnavailable()",
          from: "Marketplace",
          to: "Customer",
          details: { productId: product.productId, requested: item.quantity, available },
        });

        return {
          success: false,
          correlationId,
          stockUnavailable: true,
          error: `Insufficient stock for "${product.name}". Requested: ${item.quantity}, Available: ${available}.`,
        };
      }
    }

    // If hold expired and any price changed, customer must confirm before paying
    if (priceChangedItems.length > 0 && !params.confirmPriceChanges) {
      return {
        success: false,
        correlationId,
        priceChanged: true,
        priceChangedItems,
        error: "Prices for one or more items have updated following the 15-minute hold expiry. Please confirm the updated prices to continue.",
      };
    }

    // If customer confirmed price changes, update cart item prices and refresh hold
    if (priceChangedItems.length > 0 && params.confirmPriceChanges) {
      for (const changed of priceChangedItems) {
        await prisma.cartItem.updateMany({
          where: { cartId: cart.cartId, productId: changed.productId },
          data: {
            price: changed.newPrice,
            priceHoldExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
          },
        });
      }
    }

    // Use current (potentially refreshed) items for total calculation
    const refreshedCart = await prisma.shoppingCart.findUnique({
      where: { customerId: params.customerId },
      include: {
        items: {
          include: {
            product: {
              include: { inventoryItem: true, store: true },
            },
          },
        },
      },
    });

    const activeItems = refreshedCart?.items ?? cart.items;
    const refreshedStoreMap = new Map<number, typeof activeItems>();
    for (const item of activeItems) {
      const storeId = item.product.storeId;
      if (!refreshedStoreMap.has(storeId)) {
        refreshedStoreMap.set(storeId, []);
      }
      refreshedStoreMap.get(storeId)!.push(item);
    }

    // Step 21 & 22: For each store, Order.createOrder() status PLACED
    // Step 23 & 24: Reserve stock via InventoryItem.reserveStock(quantity)
    const createdOrders: any[] = [];
    let grandTotal = 0;

    const storeEntries = Array.from(refreshedStoreMap.entries());
    for (const [storeId, storeItems] of storeEntries) {
      const storeTotal = storeItems.reduce(
        (sum: number, it: any) => sum + it.price * it.quantity,
        0
      );
      grandTotal += Math.round(storeTotal);

      // Step 21: ShoppingCart -> Order createOrder()
      await trace.step({
        correlationId,
        stepNumber: 21,
        label: "createOrder()",
        from: "ShoppingCart",
        to: "Order",
        details: { storeId, itemCount: storeItems.length, subtotal: Math.round(storeTotal) },
      });

      const orderNumber = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${storeId}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create Order and reserve inventory inside atomic transaction
      const { createdOrderRow, reservedList } = await prisma.$transaction(async (tx) => {
        const orderRow = await tx.order.create({
          data: {
            customerId: params.customerId,
            storeId,
            orderNumber,
            totalAmount: Math.round(storeTotal),
            status: "PLACED",
            orderDate: now,
            correlationId,
            items: {
              create: storeItems.map((si: any) => ({
                productId: si.productId,
                quantity: si.quantity,
                unitPrice: si.price,
              })),
            },
          },
          include: { items: true },
        });

        const reservedItemsOut: Array<{ productId: number; quantity: number; newReserved: number }> = [];

        // Reserve stock for each item
        for (const si of storeItems) {
          const inv = await tx.inventoryItem.findUnique({
            where: { productId: si.productId },
          });
          if (!inv) throw new Error(`Inventory item not found for product ${si.productId}`);

          const availableNow = inv.quantity - inv.reservedQuantity;
          if (availableNow < si.quantity) {
            throw new Error(
              `stockUnavailable: Insufficient stock for product ID ${si.productId}. Available: ${availableNow}, Requested: ${si.quantity}`
            );
          }

          const newReserved = inv.reservedQuantity + si.quantity;
          await tx.inventoryItem.update({
            where: { inventoryId: inv.inventoryId },
            data: { reservedQuantity: newReserved },
          });

          // If available stock is now 0 and reserved > 0, transition product status to RESERVED
          const availableLeft = inv.quantity - newReserved;
          if (availableLeft === 0) {
            await tx.product.update({
              where: { productId: si.productId },
              data: { status: "RESERVED" },
            });
          }

          reservedItemsOut.push({
            productId: si.productId,
            quantity: si.quantity,
            newReserved,
          });
        }

        return { createdOrderRow: orderRow, reservedList: reservedItemsOut };
      });

      // Step 22: Order -> CheckoutService orderCreated
      await trace.step({
        correlationId,
        stepNumber: 22,
        label: "orderCreated",
        from: "Order",
        to: "CheckoutService",
        details: { orderId: createdOrderRow.orderId, orderNumber: createdOrderRow.orderNumber },
      });

      // Trace steps 23 & 24 for each reserved item
      for (const resItem of reservedList) {
        // Step 23: Order -> InventoryItem reserveStock(quantity)
        await trace.step({
          correlationId,
          stepNumber: 23,
          label: "reserveStock(quantity)",
          from: "Order",
          to: "InventoryItem",
          details: { orderId: createdOrderRow.orderId, productId: resItem.productId, quantity: resItem.quantity },
        });

        // Step 24: InventoryItem -> Order stockReserved
        await trace.step({
          correlationId,
          stepNumber: 24,
          label: "stockReserved",
          from: "InventoryItem",
          to: "Order",
          details: { productId: resItem.productId, reservedQuantity: resItem.newReserved },
        });
      }

      createdOrders.push(createdOrderRow);
    }

    const orderIds = createdOrders.map((o) => o.orderId);

    // Step 25 & 26: Call PaymentService.processPayment
    const paymentResult = await this.paymentService.processPayment({
      amount: grandTotal,
      method: params.paymentMethod,
      cardDetails: params.cardDetails,
      upiId: params.upiId,
      walletName: params.walletName,
      orderIds,
      correlationId,
      simulateFailure: params.simulateFailure,
    });

    // 4. Handle Payment Failure: steps 41-45
    if (!paymentResult.success) {
      // Rollback reservations, cancel orders, set payment FAILED in transaction
      await prisma.$transaction(async (tx) => {
        for (const order of createdOrders) {
          await tx.payment.create({
            data: {
              orderId: order.orderId,
              amount: order.totalAmount,
              method: params.paymentMethod,
              status: "FAILED",
              paymentDate: now,
              transactionId: paymentResult.transactionId,
            },
          });

          await tx.order.update({
            where: { orderId: order.orderId },
            data: { status: "CANCELLED" },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: order.orderId,
              status: "CANCELLED",
              note: `Cancelled due to payment authorization failure: ${paymentResult.failureReason}`,
            },
          });

          for (const item of order.items) {
            const inv = await tx.inventoryItem.findUnique({
              where: { productId: item.productId },
            });
            if (inv) {
              const newReserved = Math.max(0, inv.reservedQuantity - item.quantity);
              await tx.inventoryItem.update({
                where: { inventoryId: inv.inventoryId },
                data: { reservedQuantity: newReserved },
              });

              // Transition product back to ACTIVE if it was RESERVED
              const available = inv.quantity - newReserved;
              if (available > 0) {
                await tx.product.update({
                  where: { productId: item.productId },
                  data: { status: "ACTIVE" },
                });
              }
            }
          }
        }
      });

      // Trace rollback steps 43, 44 outside of SQLite transaction
      for (const order of createdOrders) {
        for (const item of order.items) {
          // Step 43: Order -> InventoryItem releaseReservedStock()
          await trace.step({
            correlationId,
            stepNumber: 43,
            label: "releaseReservedStock()",
            from: "Order",
            to: "InventoryItem",
            details: { orderId: order.orderId, productId: item.productId, quantity: item.quantity },
          });

          // Step 44: InventoryItem -> Order stockReleased
          await trace.step({
            correlationId,
            stepNumber: 44,
            label: "stockReleased",
            from: "InventoryItem",
            to: "Order",
            details: { productId: item.productId, quantity: item.quantity },
          });
        }
      }

      // Step 45: Order -> Customer paymentFailed()
      await trace.step({
        correlationId,
        stepNumber: 45,
        label: "paymentFailed()",
        from: "Order",
        to: "Customer",
        details: { reason: paymentResult.failureReason, orderIds },
      });

      // Emit event
      eventBus.emitEvent("ORDER_CANCELLED", {
        orderIds,
        reason: paymentResult.failureReason || "Payment Failed",
        timestamp: now,
      });

      return {
        success: false,
        correlationId,
        error: paymentResult.failureReason || "Payment authorization failed. Stock reservation has been safely released.",
        orders: createdOrders,
      };
    }

    // 5. Handle Payment Success: steps 27-31
    const committedItems: Array<{ productId: number; quantity: number; remainingQuantity: number }> = [];

    await prisma.$transaction(async (tx) => {
      for (const order of createdOrders) {
        // Create payment record
        await tx.payment.create({
          data: {
            orderId: order.orderId,
            amount: order.totalAmount,
            method: params.paymentMethod,
            status: "SUCCESSFUL",
            paymentDate: now,
            transactionId: paymentResult.transactionId,
          },
        });

        // Update order status to CONFIRMED
        await tx.order.update({
          where: { orderId: order.orderId },
          data: { status: "CONFIRMED" },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.orderId,
            status: "CONFIRMED",
            note: "Payment completed successfully. Order confirmed.",
          },
        });

        // Reduce stock on InventoryItem
        for (const item of order.items) {
          const inv = await tx.inventoryItem.findUnique({
            where: { productId: item.productId },
          });

          if (inv) {
            const newQty = Math.max(0, inv.quantity - item.quantity);
            const newReserved = Math.max(0, inv.reservedQuantity - item.quantity);

            await tx.inventoryItem.update({
              where: { inventoryId: inv.inventoryId },
              data: {
                quantity: newQty,
                reservedQuantity: newReserved,
              },
            });

            // If quantity hits 0 after reduceStock -> SOLD (BR-5)
            if (newQty === 0) {
              await tx.product.update({
                where: { productId: item.productId },
                data: { status: "SOLD" },
              });
            } else if (newQty > 0 && inv.quantity - newReserved > 0) {
              await tx.product.update({
                where: { productId: item.productId },
                data: { status: "ACTIVE" },
              });
            }

            committedItems.push({
              productId: item.productId,
              quantity: item.quantity,
              remainingQuantity: newQty,
            });
          }
        }
      }

      // Step 31: Clear cart
      await tx.cartItem.deleteMany({
        where: { cartId: cart.cartId },
      });

      await tx.shoppingCart.update({
        where: { cartId: cart.cartId },
        data: { totalAmount: 0 },
      });
    });

    // Record trace steps 29, 30, 31 outside of database transaction
    for (const order of createdOrders) {
      await trace.step({
        correlationId,
        stepNumber: 29,
        label: 'updateStatus("Confirmed")',
        from: "Order",
        to: "Order",
        details: { orderId: order.orderId, status: "CONFIRMED" },
      });

      for (const item of order.items) {
        // Step 30: Order -> InventoryItem reduceStock(quantity)
        await trace.step({
          correlationId,
          stepNumber: 30,
          label: "reduceStock(quantity)",
          from: "Order",
          to: "InventoryItem",
          details: { orderId: order.orderId, productId: item.productId, quantity: item.quantity },
        });

        // Step 31: InventoryItem -> Order inventoryUpdated
        await trace.step({
          correlationId,
          stepNumber: 31,
          label: "inventoryUpdated",
          from: "InventoryItem",
          to: "Order",
          details: { productId: item.productId, reducedBy: item.quantity },
        });
      }
    }

    // Step 32: After step 31, CheckoutService calls createDelivery()
    const customer = await prisma.customer.findUnique({
      where: { customerId: params.customerId },
    });
    const deliveryAddress = customer?.deliveryAddress || "Standard Delivery Address";

    for (const order of createdOrders) {
      await deliveryService.createDelivery({
        orderId: order.orderId,
        deliveryAddress,
        correlationId,
      });

      // Notification to store owner: NEW_ORDER
      const store = await prisma.store.findUnique({
        where: { storeId: order.storeId },
      });
      if (store) {
        await notificationService.sendNotification({
          userId: store.ownerId,
          type: "NEW_ORDER",
          message: `New order #${order.orderNumber} received for ₹${order.totalAmount}. Please accept within 15 minutes.`,
          correlationId,
        });
      }
    }

    // Notification to customer: ORDER_CONFIRMATION
    await notificationService.sendNotification({
      userId: params.customerId,
      type: "ORDER_CONFIRMATION",
      message: `Your order(s) ${createdOrders.map((o) => o.orderNumber).join(", ")} confirmed! Tracking created.`,
      correlationId,
    });

    // 6. Emit application domain events
    eventBus.emitEvent("ORDER_CONFIRMED", {
      orderIds,
      orderNumbers: createdOrders.map((o) => o.orderNumber),
      totalAmount: grandTotal,
      customerId: params.customerId,
      timestamp: now,
    });

    eventBus.emitEvent("INVENTORY_COMMITTED", {
      items: committedItems,
      timestamp: now,
    });

    return {
      success: true,
      correlationId,
      orders: createdOrders,
      payment: {
        transactionId: paymentResult.transactionId,
        amount: grandTotal,
        method: params.paymentMethod,
        status: "SUCCESSFUL",
      },
    };
  }
}

export const checkoutService = new CheckoutService();
