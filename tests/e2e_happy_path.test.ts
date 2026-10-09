/**
 * E2E Happy Path Test: Full sequence steps 20-40 + Payment Failure branch (41-45)
 *
 * This test seeds a complete DB scenario (store, product, customer, delivery partner),
 * then drives CheckoutService -> StoreOrderService -> DeliveryService, verifying:
 *   - Every trace step 20-40 is logged (happy path)
 *   - Every trace step 41-45 is logged (payment failure branch)
 *   - Inventory reservation/reduction/release are correct at each stage
 *   - Order status transitions follow the diagram
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { CheckoutService } from "@/services/CheckoutService";
import { DeliveryService } from "@/services/DeliveryService";
import { StoreOrderService } from "@/services/StoreOrderService";
import { MarketplaceService } from "@/services/MarketplaceService";
import { CartService } from "@/services/CartService";
import bcrypt from "bcryptjs";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const PREFIX = `e2e-${Date.now()}`;
const passwordHash = bcrypt.hashSync("Test1234!", 10);

async function traceSteps(correlationId: string): Promise<number[]> {
  const logs = await prisma.traceLog.findMany({
    where: { correlationId },
    orderBy: { traceId: "asc" },
  });
  return logs.map((l) => l.stepNumber);
}

// ─────────────────────────────────────────────────────────────
// DB Setup
// ─────────────────────────────────────────────────────────────
let storeOwnerId: number;
let storeId: number;
let productId: number;
let customerId: number;
let customerUserId: number;
let deliveryPartnerId: number;
let pricingRuleId: number;

beforeAll(async () => {
  clock.reset();

  // Store owner user
  const ownerUser = await prisma.user.create({
    data: {
      name: "E2E Store Owner",
      email: `${PREFIX}-owner@test.com`,
      passwordHash,
      phone: "9000000001",
      role: "STORE_OWNER",
    },
  });
  storeOwnerId = ownerUser.userId;
  await prisma.storeOwner.create({ data: { ownerId: storeOwnerId } });

  // Store
  const store = await prisma.store.create({
    data: {
      storeName: "E2E Test Store",
      address: "123 Test Street",
      status: "VERIFIED",
      ownerId: storeOwnerId,
    },
  });
  storeId = store.storeId;

  // Pricing rule
  const rule = await prisma.pricingRule.create({
    data: {
      discountRate: 0.05,
      expiryThresholdHours: 24,
      maximumDiscount: 0.80,
      minimumPriceFloor: 10.0,
      storeId,
    },
  });
  pricingRuleId = rule.ruleId;

  // Product with inventory
  const now = clock.now();
  const product = await prisma.product.create({
    data: {
      name: "E2E Test Milk",
      category: "Dairy",
      originalPrice: 100,
      currentPrice: 100,
      expiryDateTime: new Date(now.getTime() + 20 * 3600 * 1000), // 20h from now
      status: "ACTIVE",
      storeId,
      pricingRuleId,
    },
  });
  productId = product.productId;
  await prisma.inventoryItem.create({
    data: { productId, quantity: 10, reservedQuantity: 0 },
  });

  // Customer user
  const custUser = await prisma.user.create({
    data: {
      name: "E2E Customer",
      email: `${PREFIX}-customer@test.com`,
      passwordHash,
      phone: "9000000002",
      role: "CUSTOMER",
    },
  });
  customerUserId = custUser.userId;
  customerId = custUser.userId;
  await prisma.customer.create({
    data: { customerId, deliveryAddress: "456 Customer Lane" },
  });
  await prisma.shoppingCart.create({ data: { customerId, totalAmount: 0 } });

  // Add item to cart
  const cart = await prisma.shoppingCart.findUnique({ where: { customerId } });
  await prisma.cartItem.create({
    data: {
      cartId: cart!.cartId,
      productId,
      quantity: 2,
      price: 100,
      priceHoldExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    },
  });
  await prisma.shoppingCart.update({
    where: { cartId: cart!.cartId },
    data: { totalAmount: 200 },
  });

  // Delivery partner
  const dpUser = await prisma.user.create({
    data: {
      name: "E2E Delivery Partner",
      email: `${PREFIX}-partner@test.com`,
      passwordHash,
      phone: "9000000003",
      role: "DELIVERY_PARTNER",
    },
  });
  deliveryPartnerId = dpUser.userId;
  await prisma.deliveryPartner.create({
    data: { partnerId: deliveryPartnerId, vehicleNumber: "E2E-TEST-01" },
  });
});

afterAll(async () => {
  // Clean up in FK order
  await prisma.traceLog.deleteMany({ where: { correlationId: { startsWith: PREFIX } } });
  await prisma.notification.deleteMany({ where: { user: { name: { startsWith: "E2E" } } } });
  await prisma.delivery.deleteMany({ where: { order: { store: { storeName: "E2E Test Store" } } } });
  await prisma.payment.deleteMany({ where: { order: { store: { storeName: "E2E Test Store" } } } });
  await prisma.orderStatusHistory.deleteMany({ where: { order: { store: { storeName: "E2E Test Store" } } } });
  await prisma.orderItem.deleteMany({ where: { order: { store: { storeName: "E2E Test Store" } } } });
  await prisma.order.deleteMany({ where: { storeId } });
  await prisma.cartItem.deleteMany({ where: { productId } });
  await prisma.inventoryItem.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { storeId } });
  await prisma.pricingRule.deleteMany({ where: { storeId } });
  await prisma.shoppingCart.deleteMany({ where: { customerId } });
  await prisma.customer.deleteMany({ where: { customerId } });
  await prisma.user.deleteMany({ where: { name: { startsWith: "E2E" } } });
  await prisma.store.deleteMany({ where: { storeName: "E2E Test Store" } });
  await prisma.storeOwner.deleteMany({ where: { ownerId: storeOwnerId } });
  await prisma.deliveryPartner.deleteMany({ where: { partnerId: deliveryPartnerId } });
});

// ─────────────────────────────────────────────────────────────
// TEST 1: Full Happy Path — Steps 20-40
// ─────────────────────────────────────────────────────────────
describe("E2E Happy Path: Steps 20–40 (checkout -> store accept -> partner delivers)", () => {
  let correlationId: string;
  let orderId: number;
  let deliveryId: number;
  let assignedPartnerId: number;

  it("Step 20-31: checkout() creates order, reserves stock, processes payment, reduces stock", async () => {
    const checkoutService = new CheckoutService();
    const result = await checkoutService.checkout({
      customerId,
      paymentMethod: "UPI",
      upiId: "customer@upi",
      correlationId: `${PREFIX}-happy`,
    });

    correlationId = result.correlationId;
    expect(result.success).toBe(true);
    expect(result.orders).toBeDefined();
    expect(result.orders!.length).toBe(1);
    orderId = result.orders![0].orderId;

    // Verify order in DB
    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order).toBeTruthy();
    expect(order!.status).toBe("CONFIRMED");

    // Inventory: quantity decreased, reservedQuantity = 0 (reduce happened)
    const inv = await prisma.inventoryItem.findUnique({ where: { productId } });
    expect(inv!.quantity).toBe(8); // started 10, reduced by 2
    expect(inv!.reservedQuantity).toBe(0);

    // Payment recorded
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment!.status).toBe("SUCCESSFUL");

    // Trace steps 20-31 are all logged
    const steps = await traceSteps(correlationId);
    const required = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
    for (const step of required) {
      expect(steps, `Expected step ${step} in trace`).toContain(step);
    }
  });

  it("Step 32-33: createDelivery() creates delivery and assigns partner", async () => {
    // Delivery should have been created by checkout
    const delivery = await prisma.delivery.findUnique({ where: { orderId } });
    expect(delivery).toBeTruthy();
    expect(delivery!.status).toBe("ASSIGNED");
    expect(delivery!.partnerId).toBeDefined();
    deliveryId = delivery!.deliveryId;
    assignedPartnerId = delivery!.partnerId!;

    const steps = await traceSteps(correlationId);
    expect(steps).toContain(32);
    expect(steps).toContain(33);
  });

  it("Step 34: acceptDelivery() → status ACCEPTED", async () => {
    const deliveryService = new DeliveryService();
    const result = await deliveryService.acceptDelivery(deliveryId, assignedPartnerId, correlationId);
    expect(result.success).toBe(true);
    expect(result.status).toBe("ACCEPTED");

    const steps = await traceSteps(correlationId);
    expect(steps).toContain(34);
  });

  it("Store accept: acceptOrder() transitions order to PREPARING", async () => {
    // Store owner accepts the order (required before out-for-delivery)
    const storeOrderService = new StoreOrderService();
    await storeOrderService.acceptOrder(orderId, storeId);

    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe("PREPARING");
  });

  it("Step 35-37: setOutForDelivery() → OUT_FOR_DELIVERY + notification sent", async () => {
    const deliveryService = new DeliveryService();
    const result = await deliveryService.setOutForDelivery(deliveryId, assignedPartnerId, correlationId);
    expect(result.success).toBe(true);

    // Delivery status
    const delivery = await prisma.delivery.findUnique({ where: { deliveryId } });
    expect(delivery!.status).toBe("OUT_FOR_DELIVERY");

    // Order status
    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe("OUT_FOR_DELIVERY");

    // Notification sent to customer
    const notif = await prisma.notification.findFirst({
      where: { userId: customerUserId, type: "DELIVERY_UPDATE" },
      orderBy: { notificationId: "desc" },
    });
    expect(notif).toBeTruthy();

    const steps = await traceSteps(correlationId);
    expect(steps).toContain(35);
    expect(steps).toContain(36);
    expect(steps).toContain(37);
  });

  it("Step 38-40: setDelivered() → DELIVERED + notification sent", async () => {
    const deliveryService = new DeliveryService();
    const result = await deliveryService.setDelivered(deliveryId, assignedPartnerId, correlationId);
    expect(result.success).toBe(true);

    // Delivery status
    const delivery = await prisma.delivery.findUnique({ where: { deliveryId } });
    expect(delivery!.status).toBe("DELIVERED");

    // Order status
    const order = await prisma.order.findUnique({ where: { orderId } });
    expect(order!.status).toBe("DELIVERED");

    const steps = await traceSteps(correlationId);
    expect(steps).toContain(38);
    expect(steps).toContain(39);
    expect(steps).toContain(40);

    // Full sequence 20-40 all present
    const allRequired = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
    for (const step of allRequired) {
      expect(steps, `Step ${step} missing from trace`).toContain(step);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// TEST 2: Payment Failure Branch — Steps 41-45
// ─────────────────────────────────────────────────────────────
describe("E2E Payment Failure Branch: Steps 41-45 (stock released on payment failure)", () => {
  let failCorrelationId: string;

  beforeAll(async () => {
    // Re-stock the product so we can test the failure branch
    await prisma.inventoryItem.update({
      where: { productId },
      data: { quantity: 10, reservedQuantity: 0 },
    });

    // Rebuild the cart with a new item
    const cart = await prisma.shoppingCart.findUnique({ where: { customerId } });
    await prisma.cartItem.deleteMany({ where: { cartId: cart!.cartId } });
    const now = clock.now();
    await prisma.cartItem.create({
      data: {
        cartId: cart!.cartId,
        productId,
        quantity: 3,
        price: 100,
        priceHoldExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      },
    });
    await prisma.shoppingCart.update({
      where: { cartId: cart!.cartId },
      data: { totalAmount: 300 },
    });
  });

  it("Steps 41-45: checkout with failing card releases reserved stock and returns error", async () => {
    const invBefore = await prisma.inventoryItem.findUnique({ where: { productId } });
    const qtyBefore = invBefore!.quantity;
    const reservedBefore = invBefore!.reservedQuantity;

    const checkoutService = new CheckoutService();
    const result = await checkoutService.checkout({
      customerId,
      paymentMethod: "CARD",
      cardDetails: {
        cardNumber: "4111 1111 1111 0000", // ends in 0000 → failure trigger
        cardholderName: "E2E Test",
        expiry: "12/29",
        cvv: "123",
      },
      correlationId: `${PREFIX}-fail`,
    });

    failCorrelationId = result.correlationId;

    // Checkout must report failure
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    // No order should be CONFIRMED (it should be CANCELLED or absent)
    const orders = await prisma.order.findMany({
      where: { customerId, status: "CONFIRMED", correlationId: failCorrelationId },
    });
    expect(orders.length).toBe(0);

    // Stock must be fully released — quantity unchanged, reservedQuantity back to 0
    const invAfter = await prisma.inventoryItem.findUnique({ where: { productId } });
    expect(invAfter!.quantity).toBe(qtyBefore);
    expect(invAfter!.reservedQuantity).toBe(reservedBefore);

    // Trace: steps 41, 42, 43, 44, 45 logged
    const steps = await traceSteps(failCorrelationId);
    expect(steps).toContain(41); // paymentFailed  PaymentGateway -> Payment
    expect(steps).toContain(42); // paymentFailed  Payment -> Order
    expect(steps).toContain(43); // releaseReservedStock
    expect(steps).toContain(44); // stockReleased
    expect(steps).toContain(45); // paymentFailed() -> Customer
  });

  it("Payment row records FAILED status when card declined", async () => {
    // The order may have been created then cancelled in the same transaction
    // Find any payment row with FAILED status
    const payments = await prisma.payment.findMany({
      where: { status: "FAILED", order: { correlationId: failCorrelationId } },
    });
    expect(payments.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST 3: Full End-to-End Workflow: Search -> Cart -> Pay -> Store Accept -> Deliver (Steps 1–40)
// ─────────────────────────────────────────────────────────────
describe("E2E Full Workflow: Search -> Cart -> Pay -> Store Accept -> Deliver (Steps 1–40)", () => {
  it("executes the complete sequence from marketplace search all the way through delivery", async () => {
    const fullCorrelationId = `${PREFIX}-complete-flow`;

    // Ensure product has available inventory and cart is clear
    await prisma.inventoryItem.update({
      where: { productId },
      data: { quantity: 15, reservedQuantity: 0 },
    });
    const cart = await prisma.shoppingCart.findUnique({ where: { customerId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.cartId } });
      await prisma.shoppingCart.update({
        where: { cartId: cart.cartId },
        data: { totalAmount: 0 },
      });
    }

    // 1. Search Marketplace (Steps 1-14)
    const marketplaceService = new MarketplaceService();
    const searchRes = await marketplaceService.searchProduct("E2E Test Milk", {}, fullCorrelationId);
    expect(searchRes.total).toBeGreaterThan(0);
    const foundProduct = searchRes.products.find((p) => p.id === productId);
    expect(foundProduct).toBeDefined();

    // 2. Add to Cart (Steps 15-19)
    const cartService = new CartService();
    const addRes = await cartService.addItem(customerId, productId, 2, fullCorrelationId);
    expect(addRes.cartUpdated).toBe(true);

    // 3. Checkout & Payment (Steps 20-33)
    const checkoutService = new CheckoutService();
    const checkoutRes = await checkoutService.checkout({
      customerId,
      paymentMethod: "UPI",
      upiId: "customer@upi",
      correlationId: fullCorrelationId,
    });
    expect(checkoutRes.success).toBe(true);
    expect(checkoutRes.orders).toBeDefined();
    expect(checkoutRes.orders!.length).toBe(1);
    const flowOrderId = checkoutRes.orders![0].orderId;

    // Delivery was created and assigned at checkout (Steps 32-33)
    const delivery = await prisma.delivery.findUnique({ where: { orderId: flowOrderId } });
    expect(delivery).toBeDefined();
    expect(delivery!.partnerId).toBeDefined();
    const flowDeliveryId = delivery!.deliveryId;
    const flowPartnerId = delivery!.partnerId!;

    // 4. Delivery Partner Accepts Assignment (Step 34)
    const deliveryService = new DeliveryService();
    const acceptDeliveryRes = await deliveryService.acceptDelivery(
      flowDeliveryId,
      flowPartnerId,
      fullCorrelationId
    );
    expect(acceptDeliveryRes.success).toBe(true);

    // 5. Store Owner Accepts Order -> PREPARING
    const storeOrderService = new StoreOrderService();
    const acceptOrderRes = await storeOrderService.acceptOrder(flowOrderId, storeId);
    expect(acceptOrderRes.success).toBe(true);

    // 6. Delivery Partner Picks Up -> OUT_FOR_DELIVERY (Steps 35-37)
    const outRes = await deliveryService.setOutForDelivery(
      flowDeliveryId,
      flowPartnerId,
      fullCorrelationId
    );
    expect(outRes.success).toBe(true);

    // 7. Delivery Partner Completes -> DELIVERED (Steps 38-40)
    const deliveredRes = await deliveryService.setDelivered(
      flowDeliveryId,
      flowPartnerId,
      fullCorrelationId
    );
    expect(deliveredRes.success).toBe(true);

    // Verify order and delivery state
    const finalOrder = await prisma.order.findUnique({ where: { orderId: flowOrderId } });
    expect(finalOrder!.status).toBe("DELIVERED");

    const finalDelivery = await prisma.delivery.findUnique({ where: { deliveryId: flowDeliveryId } });
    expect(finalDelivery!.status).toBe("DELIVERED");

    // Verify all sequence steps 1-40 were logged under this correlation ID
    const steps = await traceSteps(fullCorrelationId);
    for (let step = 1; step <= 40; step++) {
      expect(steps, `Expected step ${step} in full happy path trace`).toContain(step);
    }
  });
});
