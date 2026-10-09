import { describe, it, expect, beforeEach } from "vitest";
import { Product } from "@/domain/Product";
import { InventoryItem } from "@/domain/InventoryItem";
import { ShoppingCart } from "@/domain/ShoppingCart";
import { CartItem } from "@/domain/CartItem";
import { Customer } from "@/domain/Customer";
import { CheckoutService } from "@/services/CheckoutService";
import { PaymentService } from "@/services/PaymentService";
import { cartService } from "@/services/CartService";
import { eventBus } from "@/lib/events";
import { clock } from "@/lib/clock";
import { prisma } from "@/lib/prisma";

describe("Module 2 Part A: ShoppingCart, Checkout & Payment (Steps 15-31, 41-48)", () => {
  beforeEach(() => {
    clock.reset();
  });

  describe("ShoppingCart Domain & Item Management (Steps 15-19)", () => {
    it("validates inventory availability on addItem and throws stockUnavailable if insufficient", async () => {
      const product = new Product({
        productId: 101,
        name: "Organic Milk",
        category: "Dairy",
        originalPrice: 70,
        currentPrice: 70,
        expiryDateTime: new Date(Date.now() + 24 * 3600 * 1000),
        status: "ACTIVE",
      });

      const inventory = new InventoryItem({
        inventoryId: 1,
        quantity: 5,
        reservedQuantity: 3, // only 2 available
        productId: 101,
      });

      const cart = new ShoppingCart({ cartId: 1 });
      const correlationId = `test-cart-avail-${Date.now()}`;

      // Requesting 3 units when only 2 are available -> throws
      await expect(
        cart.addItem(product, 3, { inventory, correlationId })
      ).rejects.toThrow("stockUnavailable: insufficient unreserved stock");

      // Verify trace records steps 46, 47, 48
      const logs = await prisma.traceLog.findMany({
        where: { correlationId },
        orderBy: { traceId: "asc" },
      });
      const stepNumbers = logs.map((l) => l.stepNumber);
      expect(stepNumbers).toContain(46);
      expect(stepNumbers).toContain(47);
      expect(stepNumbers).toContain(48);
    });

    it("adds item to cart with 15-minute price hold, calculates total, and emits steps 15-19", async () => {
      const now = new Date("2026-10-10T10:00:00Z");
      clock.setFixed(now);

      const product = new Product({
        productId: 102,
        name: "Greek Yogurt",
        category: "Dairy",
        originalPrice: 120,
        currentPrice: 90,
        expiryDateTime: new Date(now.getTime() + 18 * 3600 * 1000),
        status: "ACTIVE",
        now,
      });

      const inventory = new InventoryItem({
        inventoryId: 2,
        quantity: 10,
        reservedQuantity: 0,
        productId: 102,
      });

      const cart = new ShoppingCart({ cartId: 2 });
      const correlationId = `test-cart-add-${Date.now()}`;

      const res = await cart.addItem(product, 2, {
        inventory,
        correlationId,
        now,
      });

      expect(res.cartUpdated).toBe(true);
      expect(cart.items.length).toBe(1);
      expect(cart.totalAmount).toBe(180); // 2 * 90

      // Price hold expires in exactly 15 minutes (BR-7)
      const expectedHold = new Date(now.getTime() + 15 * 60 * 1000);
      expect(res.item.priceHoldExpiresAt?.getTime()).toBe(expectedHold.getTime());
      expect(res.item.isPriceHoldExpired(now)).toBe(false);

      // Verify trace sequence steps 15 through 19
      const logs = await prisma.traceLog.findMany({
        where: { correlationId },
        orderBy: { traceId: "asc" },
      });
      const stepNumbers = logs.map((l) => l.stepNumber);
      expect(stepNumbers).toEqual([15, 16, 17, 18, 19]);
    });

    it("validates inventory on CartItem.updateQuantity()", () => {
      const item = new CartItem({
        cartItemId: 1,
        productId: 103,
        quantity: 2,
        price: 50,
      });

      const inventory = new InventoryItem({
        inventoryId: 3,
        quantity: 4,
        reservedQuantity: 0,
        productId: 103,
      });

      // Updating within available quantity succeeds
      item.updateQuantity(3, inventory);
      expect(item.quantity).toBe(3);

      // Updating beyond available quantity throws
      expect(() => item.updateQuantity(5, inventory)).toThrow(
        "stockUnavailable: insufficient unreserved stock"
      );
    });

    it("supports multi-store items in one cart and updates totals on removeItem()", () => {
      const item1 = new CartItem({ cartItemId: 1, productId: 201, quantity: 2, price: 40 }); // Store A
      const item2 = new CartItem({ cartItemId: 2, productId: 301, quantity: 1, price: 100 }); // Store B

      const cart = new ShoppingCart({ cartId: 5, items: [item1, item2] });
      expect(cart.totalAmount).toBe(180);

      cart.removeItem(1);
      expect(cart.items.length).toBe(1);
      expect(cart.totalAmount).toBe(100);
    });
  });

  describe("Customer.placeOrder() & Checkout Flow", () => {
    it("delegates Customer.placeOrder() to CheckoutService.checkout()", async () => {
      const customer = new Customer({
        userId: 10,
        customerId: 10,
        name: "Test Customer",
        email: "customer@test.com",
        passwordHash: "hash",
        phone: "9876543210",
        deliveryAddress: "123 Green Street",
      });

      let checkoutCalled = false;
      const mockCheckoutService = {
        checkout: async (params: any) => {
          checkoutCalled = true;
          expect(params.customerId).toBe(10);
          expect(params.paymentMethod).toBe("CARD");
          return { success: true, correlationId: "test-corr" };
        },
      };

      const result = await customer.placeOrder(mockCheckoutService as any, {
        paymentMethod: "CARD",
      });

      expect(checkoutCalled).toBe(true);
      expect(result.success).toBe(true);
    });

    it("rejects checkout on an empty shopping cart", async () => {
      // Find or create customer with empty cart
      const user = await prisma.user.upsert({
        where: { email: "emptycart@test.com" },
        update: {},
        create: {
          name: "Empty Cart User",
          email: "emptycart@test.com",
          passwordHash: "hashed",
          phone: "9999999901",
          role: "CUSTOMER",
          customer: { create: { deliveryAddress: "Empty Street" } },
        },
      });

      await prisma.shoppingCart.upsert({
        where: { customerId: user.userId },
        update: { totalAmount: 0 },
        create: { customerId: user.userId, totalAmount: 0 },
      });
      await prisma.cartItem.deleteMany({
        where: { cart: { customerId: user.userId } },
      });

      const checkoutService = new CheckoutService();
      await expect(
        checkoutService.checkout({
          customerId: user.userId,
          paymentMethod: "CARD",
        })
      ).rejects.toThrow("Cannot checkout an empty shopping cart");
    });
  });

  describe("End-to-End Checkout Workflow with Database & Sequence Trace", () => {
    let testCustomerId: number;
    let store1Id: number;
    let store2Id: number;
    let product1Id: number;
    let product2Id: number;

    beforeEach(async () => {
      // Setup test customer, 2 stores, 2 products with inventory
      const customerUser = await prisma.user.upsert({
        where: { email: "mod2customer@test.com" },
        update: {},
        create: {
          name: "Module 2 Customer",
          email: "mod2customer@test.com",
          passwordHash: "hash123",
          phone: "9876500001",
          role: "CUSTOMER",
          customer: { create: { deliveryAddress: "77 Elm Street" } },
        },
      });
      testCustomerId = customerUser.userId;

      const ownerUser = await prisma.user.upsert({
        where: { email: "mod2owner@test.com" },
        update: {},
        create: {
          name: "Store Owner 2",
          email: "mod2owner@test.com",
          passwordHash: "hash123",
          phone: "9876500002",
          role: "STORE_OWNER",
          storeOwner: { create: {} },
        },
      });

      const store1 = await prisma.store.upsert({
        where: { storeId: 9001 },
        update: { status: "VERIFIED" },
        create: {
          storeId: 9001,
          storeName: "FreshMart Express",
          address: "1st Avenue Market",
          status: "VERIFIED",
          ownerId: ownerUser.userId,
        },
      });
      store1Id = store1.storeId;

      const store2 = await prisma.store.upsert({
        where: { storeId: 9002 },
        update: { status: "VERIFIED" },
        create: {
          storeId: 9002,
          storeName: "Organic Delights",
          address: "2nd Avenue Plaza",
          status: "VERIFIED",
          ownerId: ownerUser.userId,
        },
      });
      store2Id = store2.storeId;

      // Product 1 in Store 1
      const prod1 = await prisma.product.upsert({
        where: { productId: 8001 },
        update: {
          currentPrice: 50,
          originalPrice: 100,
          status: "ACTIVE",
          expiryDateTime: new Date(Date.now() + 20 * 3600 * 1000),
        },
        create: {
          productId: 8001,
          name: "Artisan Bread",
          category: "Bakery",
          originalPrice: 100,
          currentPrice: 50,
          expiryDateTime: new Date(Date.now() + 20 * 3600 * 1000),
          status: "ACTIVE",
          storeId: store1Id,
          inventoryItem: {
            create: { quantity: 15, reservedQuantity: 0 },
          },
        },
        include: { inventoryItem: true },
      });
      product1Id = prod1.productId;

      // Product 2 in Store 2
      const prod2 = await prisma.product.upsert({
        where: { productId: 8002 },
        update: {
          currentPrice: 80,
          originalPrice: 120,
          status: "ACTIVE",
          expiryDateTime: new Date(Date.now() + 15 * 3600 * 1000),
        },
        create: {
          productId: 8002,
          name: "Fresh Strawberries",
          category: "Produce",
          originalPrice: 120,
          currentPrice: 80,
          expiryDateTime: new Date(Date.now() + 15 * 3600 * 1000),
          status: "ACTIVE",
          storeId: store2Id,
          inventoryItem: {
            create: { quantity: 10, reservedQuantity: 0 },
          },
        },
        include: { inventoryItem: true },
      });
      product2Id = prod2.productId;

      // Reset inventory quantities
      await prisma.inventoryItem.update({
        where: { productId: product1Id },
        data: { quantity: 15, reservedQuantity: 0 },
      });
      await prisma.inventoryItem.update({
        where: { productId: product2Id },
        data: { quantity: 10, reservedQuantity: 0 },
      });

      // Clear customer cart
      await prisma.shoppingCart.upsert({
        where: { customerId: testCustomerId },
        update: { totalAmount: 0 },
        create: { customerId: testCustomerId, totalAmount: 0 },
      });
      await prisma.cartItem.deleteMany({
        where: { cart: { customerId: testCustomerId } },
      });
    });

    it("executes successful checkout (Steps 20-31): splits per store, reserves and commits stock, emits events, and clears cart", async () => {
      // 1. Add items from both stores to customer's cart
      await cartService.addItem(testCustomerId, product1Id, 2); // 2 * 50 = 100 (Store 1)
      await cartService.addItem(testCustomerId, product2Id, 1); // 1 * 80 = 80  (Store 2)

      const correlationId = `checkout-success-${Date.now()}`;
      let confirmedEventReceived = false;
      let inventoryEventReceived = false;

      const cartBefore = await cartService.getCart(testCustomerId);
      const expectedTotal = cartBefore.totalAmount;

      eventBus.once("ORDER_CONFIRMED", (payload) => {
        confirmedEventReceived = true;
        expect(payload.totalAmount).toBe(expectedTotal);
      });

      eventBus.once("INVENTORY_COMMITTED", (payload) => {
        inventoryEventReceived = true;
        expect(payload.items.length).toBe(2);
      });

      // 2. Execute checkout with success card
      const checkoutService = new CheckoutService();
      const result = await checkoutService.checkout({
        customerId: testCustomerId,
        paymentMethod: "CARD",
        cardDetails: {
          cardNumber: "4111 1111 1111 1111",
          cardholderName: "John Doe",
        },
        correlationId,
      });

      expect(result.success).toBe(true);
      expect(result.orders?.length).toBe(2); // One order per store (Store 1 and Store 2)
      expect(confirmedEventReceived).toBe(true);
      expect(inventoryEventReceived).toBe(true);

      // Verify orders status is CONFIRMED
      for (const ord of result.orders!) {
        const orderInDb = await prisma.order.findUnique({
          where: { orderId: ord.orderId },
          include: { payment: true, items: true },
        });
        expect(orderInDb?.status).toBe("CONFIRMED");
        expect(orderInDb?.payment?.status).toBe("SUCCESSFUL");
      }

      // Verify stock was committed (reduced) on InventoryItems
      const inv1 = await prisma.inventoryItem.findUnique({ where: { productId: product1Id } });
      const inv2 = await prisma.inventoryItem.findUnique({ where: { productId: product2Id } });

      expect(inv1?.quantity).toBe(13); // 15 - 2
      expect(inv1?.reservedQuantity).toBe(0);
      expect(inv2?.quantity).toBe(9);  // 10 - 1
      expect(inv2?.reservedQuantity).toBe(0);

      // Verify cart was cleared (step 31)
      const cartInDb = await prisma.shoppingCart.findUnique({
        where: { customerId: testCustomerId },
        include: { items: true },
      });
      expect(cartInDb?.items.length).toBe(0);
      expect(cartInDb?.totalAmount).toBe(0);

      // Verify all sequence trace steps 20 through 31 are recorded in order
      const logs = await prisma.traceLog.findMany({
        where: { correlationId },
        orderBy: { traceId: "asc" },
      });
      const stepNumbers = logs.map((l) => l.stepNumber);

      const requiredSteps = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
      for (const s of requiredSteps) {
        expect(stepNumbers).toContain(s);
      }
    });

    it("handles simulated payment failure (Steps 41-45): cancels orders, rolls back stock reservations, and reports failure", async () => {
      // 1. Add item to cart
      await cartService.addItem(testCustomerId, product1Id, 3); // 3 units

      const correlationId = `checkout-fail-${Date.now()}`;
      let cancelEventReceived = false;

      eventBus.once("ORDER_CANCELLED", () => {
        cancelEventReceived = true;
      });

      // 2. Execute checkout with failure card (ending in 0000)
      const checkoutService = new CheckoutService();
      const result = await checkoutService.checkout({
        customerId: testCustomerId,
        paymentMethod: "CARD",
        cardDetails: {
          cardNumber: "4000 0000 0000 0000", // Ends in 0000 triggers failure branch
          cardholderName: "TEST FAIL",
        },
        correlationId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Payment authorization declined");
      expect(cancelEventReceived).toBe(true);

      // Verify order was created then CANCELLED
      const order = await prisma.order.findFirst({
        where: { customerId: testCustomerId, status: "CANCELLED" },
        include: { payment: true },
        orderBy: { orderId: "desc" },
      });
      expect(order).toBeDefined();
      expect(order?.status).toBe("CANCELLED");
      expect(order?.payment?.status).toBe("FAILED");

      // Verify reserved stock was safely released back to available inventory
      const inv = await prisma.inventoryItem.findUnique({ where: { productId: product1Id } });
      expect(inv?.quantity).toBe(15); // Unchanged
      expect(inv?.reservedQuantity).toBe(0); // Safely released!

      // Verify trace sequence steps 41 through 45 are recorded in order
      const logs = await prisma.traceLog.findMany({
        where: { correlationId },
        orderBy: { traceId: "asc" },
      });
      const stepNumbers = logs.map((l) => l.stepNumber);

      expect(stepNumbers).toContain(41); // paymentFailed
      expect(stepNumbers).toContain(42); // paymentFailed
      expect(stepNumbers).toContain(43); // releaseReservedStock
      expect(stepNumbers).toContain(44); // stockReleased
      expect(stepNumbers).toContain(45); // paymentFailed reported to customer
    });
  });
});
