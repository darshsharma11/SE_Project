import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { trace } from "@/lib/trace";
import { ShoppingCart } from "@/domain/ShoppingCart";
import { CartItem } from "@/domain/CartItem";
import { Product } from "@/domain/Product";
import { InventoryItem } from "@/domain/InventoryItem";
import { PricingEngine } from "@/domain/PricingEngine";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";

export class CartService {
  private pricingEngine: PricingEngine;

  constructor(pricingEngine?: PricingEngine) {
    this.pricingEngine = pricingEngine ?? new PricingEngine();
  }

  /**
   * Retrieves the shopping cart for a customer, calculating holds and real-time engine prices.
   */
  async getCart(customerId: number) {
    const now = clock.now();

    let cartRow = await prisma.shoppingCart.findUnique({
      where: { customerId },
      include: {
        items: {
          include: {
            product: {
              include: {
                store: true,
                inventoryItem: true,
                pricingRule: true,
              },
            },
          },
        },
      },
    });

    if (!cartRow) {
      cartRow = await prisma.shoppingCart.create({
        data: { customerId, totalAmount: 0 },
        include: {
          items: {
            include: {
              product: {
                include: {
                  store: true,
                  inventoryItem: true,
                  pricingRule: true,
                },
              },
            },
          },
        },
      });
    }

    // Process each item to check price hold and current engine price
    let computedTotal = 0;
    let totalSavings = 0;

    const formattedItems = await Promise.all(
      cartRow.items.map(async (item) => {
        const prod = item.product;
        const domainProduct = new Product({
          productId: prod.productId,
          name: prod.name,
          category: prod.category,
          originalPrice: prod.originalPrice,
          currentPrice: prod.currentPrice,
          expiryDateTime: prod.expiryDateTime,
          status: prod.status as any,
          pricingRuleId: prod.pricingRuleId ?? undefined,
          storeId: prod.storeId,
          skipExpiryCheck: true,
        });

        const ruleDomain = prod.pricingRule
          ? PricingRuleRepository.toDomain(prod.pricingRule)
          : undefined;
        const { price: latestEnginePrice } =
          await this.pricingEngine.calculateAuthoritativePrice(
            domainProduct,
            ruleDomain,
            now
          );
        const holdExpiresAt = new Date(item.priceHoldExpiresAt);
        const isHoldExpired = holdExpiresAt.getTime() <= now.getTime();
        const holdRemainingSeconds = Math.max(
          0,
          Math.floor((holdExpiresAt.getTime() - now.getTime()) / 1000)
        );

        const availableStock = prod.inventoryItem
          ? prod.inventoryItem.quantity - prod.inventoryItem.reservedQuantity
          : 0;

        const subtotal = item.price * item.quantity;
        computedTotal += subtotal;
        totalSavings += (prod.originalPrice - item.price) * item.quantity;

        return {
          cartItemId: item.cartItemId,
          productId: prod.productId,
          name: prod.name,
          category: prod.category,
          originalPrice: prod.originalPrice,
          lockedPrice: item.price,
          latestEnginePrice,
          hasPriceChanged: isHoldExpired && latestEnginePrice !== item.price,
          quantity: item.quantity,
          subtotal,
          availableStock,
          priceHoldExpiresAt: item.priceHoldExpiresAt.toISOString(),
          isHoldExpired,
          holdRemainingSeconds,
          store: {
            id: prod.store.storeId,
            name: prod.store.storeName,
            address: prod.store.address,
          },
        };
      })
    );

    // Group items by store for multi-store display
    const storeGroups: Record<
      number,
      {
        storeId: number;
        storeName: string;
        storeAddress: string;
        items: typeof formattedItems;
        subtotal: number;
      }
    > = {};

    for (const it of formattedItems) {
      if (!storeGroups[it.store.id]) {
        storeGroups[it.store.id] = {
          storeId: it.store.id,
          storeName: it.store.name,
          storeAddress: it.store.address,
          items: [],
          subtotal: 0,
        };
      }
      storeGroups[it.store.id].items.push(it);
      storeGroups[it.store.id].subtotal += it.subtotal;
    }

    return {
      cartId: cartRow.cartId,
      customerId,
      totalAmount: Math.round(computedTotal),
      totalSavings: Math.max(0, Math.round(totalSavings)),
      itemCount: formattedItems.length,
      items: formattedItems,
      stores: Object.values(storeGroups),
    };
  }

  /**
   * Sequence Step 15 through 19: addItem
   */
  async addItem(
    customerId: number,
    productId: number,
    quantity = 1,
    customCorrelationId?: string
  ) {
    const correlationId =
      customCorrelationId ?? trace.generateCorrelationId("cart-add");
    const now = clock.now();

    // Fetch product with store and inventory
    const productRow = await prisma.product.findUnique({
      where: { productId },
      include: { inventoryItem: true, pricingRule: true, store: true },
    });

    if (!productRow) {
      throw new Error("Product not found");
    }

    // Enforce server-side product availability
    if (productRow.status !== "ACTIVE") {
      throw new Error(
        `Product "${productRow.name}" is not available for purchase (status: ${productRow.status})`
      );
    }

    if (productRow.expiryDateTime.getTime() <= now.getTime()) {
      throw new Error(
        `Product "${productRow.name}" has expired and cannot be added to cart`
      );
    }

    if (productRow.store.status !== "VERIFIED") {
      throw new Error(
        `Store "${productRow.store.storeName}" is not verified for selling`
      );
    }

    const available = productRow.inventoryItem
      ? productRow.inventoryItem.quantity - productRow.inventoryItem.reservedQuantity
      : 0;

    if (available < quantity) {
      throw new Error(
        `stockUnavailable: insufficient stock for "${productRow.name}". Available: ${available}, Requested: ${quantity}`
      );
    }

    const domainProduct = new Product({
      productId: productRow.productId,
      name: productRow.name,
      category: productRow.category,
      originalPrice: productRow.originalPrice,
      currentPrice: productRow.currentPrice,
      expiryDateTime: productRow.expiryDateTime,
      status: productRow.status as any,
      pricingRuleId: productRow.pricingRuleId ?? undefined,
      storeId: productRow.storeId,
      skipExpiryCheck: true,
    });

    const domainInventory = productRow.inventoryItem
      ? new InventoryItem({
          inventoryId: productRow.inventoryItem.inventoryId,
          quantity: productRow.inventoryItem.quantity,
          reservedQuantity: productRow.inventoryItem.reservedQuantity,
          productId: productRow.productId,
        })
      : undefined;

    const domainRule = productRow.pricingRule
      ? PricingRuleRepository.toDomain(productRow.pricingRule)
      : await this.pricingEngine.resolveRuleForProduct(productRow);

    // Get or create shopping cart for customer
    let cartRow = await prisma.shoppingCart.findUnique({
      where: { customerId },
      include: { items: true },
    });

    if (!cartRow) {
      cartRow = await prisma.shoppingCart.create({
        data: { customerId, totalAmount: 0 },
        include: { items: true },
      });
    }

    const domainCart = new ShoppingCart({
      cartId: cartRow.cartId,
      customerId,
      totalAmount: cartRow.totalAmount,
      items: cartRow.items.map(
        (it) =>
          new CartItem({
            cartItemId: it.cartItemId,
            quantity: it.quantity,
            price: it.price,
            cartId: it.cartId,
            productId: it.productId,
            priceHoldExpiresAt: it.priceHoldExpiresAt,
          })
      ),
    });

    // Execute domain addItem (steps 15-19) with applicable pricing rule
    const result = await domainCart.addItem(domainProduct, quantity, {
      inventory: domainInventory,
      pricingEngine: this.pricingEngine,
      pricingRule: domainRule,
      correlationId,
      now,
    });

    // Persist to database
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cartRow.cartId, productId },
    });

    if (existingItem) {
      await prisma.cartItem.update({
        where: { cartItemId: existingItem.cartItemId },
        data: {
          quantity: existingItem.quantity + quantity,
          price: result.item.price,
          priceHoldExpiresAt: result.item.priceHoldExpiresAt!,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cartRow.cartId,
          productId,
          quantity,
          price: result.item.price,
          priceHoldExpiresAt: result.item.priceHoldExpiresAt!,
        },
      });
    }

    // Update cart total
    await prisma.shoppingCart.update({
      where: { cartId: cartRow.cartId },
      data: { totalAmount: domainCart.totalAmount },
    });

    return {
      success: true,
      correlationId,
      cartUpdated: result.cartUpdated,
      item: result.item,
      totalAmount: domainCart.totalAmount,
    };
  }

  /**
   * Update quantity with inventory validation
   */
  async updateQuantity(customerId: number, cartItemId: number, quantity: number) {
    if (quantity <= 0) {
      return this.removeItem(customerId, cartItemId);
    }

    const cart = await prisma.shoppingCart.findUnique({
      where: { customerId },
    });
    if (!cart) throw new Error("Shopping cart not found");

    const item = await prisma.cartItem.findFirst({
      where: { cartItemId, cartId: cart.cartId },
      include: { product: { include: { inventoryItem: true } } },
    });

    if (!item) throw new Error("Cart item not found");

    // Validate inventory availability
    const inv = item.product.inventoryItem;
    if (inv) {
      const available = inv.quantity - inv.reservedQuantity;
      if (available < quantity) {
        throw new Error(`stockUnavailable: insufficient stock. Only ${available} available.`);
      }
    }

    await prisma.cartItem.update({
      where: { cartItemId },
      data: { quantity },
    });

    // Recalculate cart total
    const allItems = await prisma.cartItem.findMany({
      where: { cartId: cart.cartId },
    });
    const totalAmount = allItems.reduce((acc, it) => acc + it.price * it.quantity, 0);

    await prisma.shoppingCart.update({
      where: { cartId: cart.cartId },
      data: { totalAmount: Math.round(totalAmount) },
    });

    return { success: true, quantity, totalAmount: Math.round(totalAmount) };
  }

  /**
   * Remove item from cart
   */
  async removeItem(customerId: number, cartItemId: number) {
    const cart = await prisma.shoppingCart.findUnique({
      where: { customerId },
    });
    if (!cart) throw new Error("Shopping cart not found");

    await prisma.cartItem.deleteMany({
      where: { cartItemId, cartId: cart.cartId },
    });

    // Recalculate cart total
    const allItems = await prisma.cartItem.findMany({
      where: { cartId: cart.cartId },
    });
    const totalAmount = allItems.reduce((acc, it) => acc + it.price * it.quantity, 0);

    await prisma.shoppingCart.update({
      where: { cartId: cart.cartId },
      data: { totalAmount: Math.round(totalAmount) },
    });

    return { success: true, totalAmount: Math.round(totalAmount) };
  }
}

export const cartService = new CartService();
