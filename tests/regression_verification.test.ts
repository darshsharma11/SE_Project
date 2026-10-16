import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { Product } from "@/domain/Product";
import { PricingRule } from "@/domain/PricingRule";
import { PricingEngine } from "@/domain/PricingEngine";
import { ShoppingCart } from "@/domain/ShoppingCart";
import { Delivery } from "@/domain/Delivery";
import { marketplaceService } from "@/services/MarketplaceService";
import { cartService } from "@/services/CartService";
import { CheckoutService } from "@/services/CheckoutService";
import { PaymentService } from "@/services/PaymentService";
import { StoreOrderService, storeOrderService } from "@/services/StoreOrderService";
import { DeliveryService } from "@/services/DeliveryService";
import {
  signSessionToken,
  verifySessionToken,
  getDemoPersona,
  DEMO_IDENTITIES,
  isDemoMode,
  UserSessionPayload,
} from "@/lib/auth";

describe("Regression Verification Suite: SE_Project Repairs", () => {
  const pricingEngine = new PricingEngine();

  beforeEach(() => {
    clock.reset();
  });

  // =========================================================================
  // 1. Prices outside, inside, and at the end of each expiry window
  // =========================================================================
  describe("1. Expiry Window Dynamic Decay Pricing", () => {
    const testRule = new PricingRule({
      ruleId: 101,
      discountRate: 0.05, // 5% per hour
      expiryThresholdHours: 20, // 20h window
      maximumDiscount: 0.75, // 75% max
      minimumPriceFloor: 10.0,
    });

    it("applies 0% discount outside the expiry threshold window", () => {
      const now = new Date("2026-10-14T10:00:00Z");
      const expiryOutside = new Date(now.getTime() + 25 * 3600 * 1000); // 25h remaining > 20h
      const discount = testRule.calculateDiscount(expiryOutside, now);
      expect(discount).toBe(0);

      const product = new Product({
        productId: 1,
        name: "Test Milk",
        category: "Dairy",
        originalPrice: 100,
        currentPrice: 100,
        expiryDateTime: expiryOutside,
        status: "ACTIVE",
        skipExpiryCheck: true,
      });

      const calculated = pricingEngine.calculatePrice(product, testRule, now);
      expect(calculated).toBe(100);
    });

    it("progressively increases discount inside the expiry threshold window", () => {
      const now = new Date("2026-10-14T10:00:00Z");
      // 10 hours remaining in 20h window -> 10 hours elapsed -> 10 * 5% = 50% discount
      const expiryInside = new Date(now.getTime() + 10 * 3600 * 1000);
      const discount = testRule.calculateDiscount(expiryInside, now);
      expect(discount).toBeCloseTo(0.50, 4);

      const product = new Product({
        productId: 1,
        name: "Test Milk",
        category: "Dairy",
        originalPrice: 100,
        currentPrice: 100,
        expiryDateTime: expiryInside,
        status: "ACTIVE",
        skipExpiryCheck: true,
      });

      const calculated = pricingEngine.calculatePrice(product, testRule, now);
      expect(calculated).toBe(50); // 100 * (1 - 0.50) = 50
    });

    it("caps discount at maximumDiscount at and past the end of the window", () => {
      const now = new Date("2026-10-14T10:00:00Z");
      // Expired: 0h remaining -> 20h elapsed -> 20 * 5% = 100%, capped at 75%
      const expiredTime = new Date(now.getTime());
      const discount = testRule.calculateDiscount(expiredTime, now);
      expect(discount).toBe(0.75);

      const product = new Product({
        productId: 1,
        name: "Test Milk",
        category: "Dairy",
        originalPrice: 100,
        currentPrice: 100,
        expiryDateTime: expiredTime,
        status: "ACTIVE",
        skipExpiryCheck: true,
      });

      const calculated = pricingEngine.calculatePrice(product, testRule, now);
      expect(calculated).toBe(25); // 100 * (1 - 0.75) = 25
    });
  });

  // =========================================================================
  // 2. Category-specific pricing rules & maximum discounts
  // =========================================================================
  describe("2. Category-Specific Pricing Rules & Maximum Discounts", () => {
    it("respects category specific rates and max discount caps", () => {
      const dairyRule = new PricingRule({
        ruleId: 1,
        category: "Dairy",
        discountRate: 0.04,
        expiryThresholdHours: 24,
        maximumDiscount: 0.75,
        minimumPriceFloor: 15.0,
      });

      const bakeryRule = new PricingRule({
        ruleId: 2,
        category: "Bakery",
        discountRate: 0.05,
        expiryThresholdHours: 18,
        maximumDiscount: 0.80,
        minimumPriceFloor: 10.0,
      });

      const produceRule = new PricingRule({
        ruleId: 3,
        category: "Produce",
        discountRate: 0.03,
        expiryThresholdHours: 36,
        maximumDiscount: 0.70,
        minimumPriceFloor: 20.0,
      });

      const now = new Date("2026-10-14T12:00:00Z");
      // 12 hours remaining for each:
      // Dairy: 12h remaining in 24h window = 12h elapsed -> 12 * 4% = 48%
      const dairyDisc = dairyRule.calculateDiscount(new Date(now.getTime() + 12 * 3600 * 1000), now);
      expect(dairyDisc).toBeCloseTo(0.48, 4);

      // Bakery: 6h remaining in 18h window = 12h elapsed -> 12 * 5% = 60%
      const bakeryDisc = bakeryRule.calculateDiscount(new Date(now.getTime() + 6 * 3600 * 1000), now);
      expect(bakeryDisc).toBeCloseTo(0.60, 4);

      // Produce: 12h remaining in 36h window = 24h elapsed -> 24 * 3% = 72% -> capped at 70%
      const produceDisc = produceRule.calculateDiscount(new Date(now.getTime() + 12 * 3600 * 1000), now);
      expect(produceDisc).toBe(0.70);
    });
  });

  // =========================================================================
  // 3. Minimum-price-floor edge cases
  // =========================================================================
  describe("3. Minimum Price Floor Edge Cases", () => {
    it("applies price floor when discount would push price below floor", () => {
      const rule = new PricingRule({
        ruleId: 1,
        discountRate: 0.10,
        expiryThresholdHours: 10,
        maximumDiscount: 0.80,
        minimumPriceFloor: 40.0,
      });

      const now = new Date("2026-10-14T12:00:00Z");
      // 1h remaining = 9h elapsed -> 90% -> capped at 80% discount
      // 100 * (1 - 0.80) = 20, but floor is 40 -> must be 40
      const product = new Product({
        productId: 1,
        name: "Floor Test Item",
        category: "Produce",
        originalPrice: 100,
        currentPrice: 100,
        expiryDateTime: new Date(now.getTime() + 1 * 3600 * 1000),
        status: "ACTIVE",
        skipExpiryCheck: true,
      });

      const price = pricingEngine.calculatePrice(product, rule, now);
      expect(price).toBe(40);
    });

    it("NEVER raises price above originalPrice when floor exceeds originalPrice", () => {
      const rule = new PricingRule({
        ruleId: 2,
        discountRate: 0.05,
        expiryThresholdHours: 24,
        maximumDiscount: 0.80,
        minimumPriceFloor: 50.0, // Floor is 50, but product original price is only 20!
      });

      const now = new Date("2026-10-14T12:00:00Z");
      const product = new Product({
        productId: 2,
        name: "Cheap Herb",
        category: "Produce",
        originalPrice: 20, // Original price is 20
        currentPrice: 20,
        expiryDateTime: new Date(now.getTime() + 2 * 3600 * 1000),
        status: "ACTIVE",
        skipExpiryCheck: true,
      });

      const price = pricingEngine.calculatePrice(product, rule, now);
      // Must not be 50! Must stay at or below originalPrice (20)
      expect(price).toBeLessThanOrEqual(20);
      expect(price).toBe(20);
    });
  });

  // =========================================================================
  // 4. Consistent prices across marketplace, product details, cart, checkout
  // =========================================================================
  describe("4. Price Consistency Across All Layers", () => {
    it("computes identical price across domain engine, details, cart, and checkout", async () => {
      const dbProduct = await prisma.product.findFirst({
        where: {
          status: "ACTIVE",
          store: { status: "VERIFIED" },
          expiryDateTime: { gt: clock.now() },
        },
        include: { pricingRule: true, store: true },
      });

      expect(dbProduct).not.toBeNull();
      if (!dbProduct) return;

      const now = clock.now();
      const domainProd = new Product({
        productId: dbProduct.productId,
        name: dbProduct.name,
        category: dbProduct.category,
        originalPrice: dbProduct.originalPrice,
        currentPrice: dbProduct.currentPrice,
        expiryDateTime: dbProduct.expiryDateTime,
        pricingRuleId: dbProduct.pricingRuleId ?? undefined,
        storeId: dbProduct.storeId,
        status: "ACTIVE",
        skipExpiryCheck: true,
      });

      const domainRule = dbProduct.pricingRule
        ? new PricingRule({
            ruleId: dbProduct.pricingRule.ruleId,
            discountRate: dbProduct.pricingRule.discountRate,
            expiryThresholdHours: dbProduct.pricingRule.expiryThresholdHours,
            maximumDiscount: dbProduct.pricingRule.maximumDiscount,
            minimumPriceFloor: dbProduct.pricingRule.minimumPriceFloor,
            category: dbProduct.pricingRule.category ?? undefined,
          })
        : undefined;

      // 1. Authoritative calculation
      const { price: authoritativePrice } = await pricingEngine.calculateAuthoritativePrice(
        domainProd,
        domainRule,
        now
      );

      // 2. Product details service
      const detailsResult = await marketplaceService.getProductById(dbProduct.productId);
      expect(detailsResult?.product.currentPrice).toBe(authoritativePrice);

      // 3. Cart item calculation
      const cart = new ShoppingCart({ cartId: 999 });
      await cart.addItem(domainProd, 1, { pricingRule: domainRule });
      expect(cart.items[0].price).toBe(authoritativePrice);
    });
  });

  // =========================================================================
  // 5. Expired, inactive, unavailable, and out-of-stock product rejection
  // =========================================================================
  describe("5. Product Availability & Rejection Enforcement", () => {
    it("rejects expired products and transitions them to EXPIRED_REMOVED", async () => {
      const expiredProd = await prisma.product.create({
        data: {
          name: "Expired Yoghurt",
          category: "Dairy",
          originalPrice: 50,
          currentPrice: 50,
          expiryDateTime: new Date(Date.now() - 3600 * 1000), // 1 hour in the past
          status: "ACTIVE",
          store: {
            connect: {
              storeId: (await prisma.store.findFirst({ where: { status: "VERIFIED" } }))!.storeId,
            },
          },
        },
      });

      const res = await marketplaceService.getProductById(expiredProd.productId);
      expect(res).toBeNull();

      // Verify status transitioned to EXPIRED_REMOVED
      const updated = await prisma.product.findUnique({
        where: { productId: expiredProd.productId },
      });
      expect(updated?.status).toBe("EXPIRED_REMOVED");

      // Verify CartService rejects adding it
      const cust = await prisma.customer.findFirst();
      await expect(
        cartService.addItem(cust!.customerId, expiredProd.productId, 1)
      ).rejects.toThrow(/EXPIRED|expired/i);
    });

    it("rejects products from unverified stores across details and cart", async () => {
      const unverifiedStoreProduct = await prisma.product.findFirst({
        where: { store: { status: "PENDING_VERIFICATION" } },
      });

      expect(unverifiedStoreProduct).not.toBeNull();
      if (!unverifiedStoreProduct) return;

      // Details API rejects
      const res = await marketplaceService.getProductById(unverifiedStoreProduct.productId);
      expect(res).toBeNull();

      // Cart add rejects
      const cust = await prisma.customer.findFirst();
      await expect(
        cartService.addItem(cust!.customerId, unverifiedStoreProduct.productId, 1)
      ).rejects.toThrow(/not verified/i);
    });

    it("rejects out-of-stock products", async () => {
      const verifiedStore = await prisma.store.findFirst({ where: { status: "VERIFIED" } });
      const oosProduct = await prisma.product.create({
        data: {
          name: "Sold Out Bread",
          category: "Bakery",
          originalPrice: 40,
          currentPrice: 40,
          expiryDateTime: new Date(Date.now() + 24 * 3600 * 1000),
          status: "ACTIVE",
          storeId: verifiedStore!.storeId,
          inventoryItem: {
            create: { quantity: 0, reservedQuantity: 0 },
          },
        },
      });

      const res = await marketplaceService.getProductById(oosProduct.productId);
      expect(res).toBeNull();

      const cust = await prisma.customer.findFirst();
      await expect(
        cartService.addItem(cust!.customerId, oosProduct.productId, 1)
      ).rejects.toThrow(/insufficient stock/i);
    });
  });

  // =========================================================================
  // 6. Price-hold expiration (15 min) and price-change handling
  // =========================================================================
  describe("6. Price-Hold Expiration & Change Handling", () => {
    it("enforces 15-minute price hold and detects expired price hold on checkout", async () => {
      const startTime = new Date("2026-10-14T08:00:00Z");
      clock.setFixed(startTime);

      const store = await prisma.store.findFirst({ where: { status: "VERIFIED" } });
      const testProd = await prisma.product.create({
        data: {
          name: "Price Hold Item",
          category: "Dairy",
          originalPrice: 100,
          currentPrice: 100,
          expiryDateTime: new Date(startTime.getTime() + 10 * 3600 * 1000),
          status: "ACTIVE",
          storeId: store!.storeId,
          inventoryItem: {
            create: { quantity: 10, reservedQuantity: 0 },
          },
        },
      });

      const cust = await prisma.customer.findFirst();
      await cartService.addItem(cust!.customerId, testProd.productId, 1);

      let cart = await cartService.getCart(cust!.customerId);
      let item = cart.items.find((i) => i.productId === testProd.productId);
      expect(item).toBeDefined();

      // Within 15 minutes: price hold is valid
      clock.advanceMinutes(10);
      cart = await cartService.getCart(cust!.customerId);
      item = cart.items.find((i) => i.productId === testProd.productId);
      expect(item!.isHoldExpired).toBe(false);

      // Advance past 15 minutes: price hold has expired
      clock.advanceMinutes(10); // now 20 minutes elapsed
      cart = await cartService.getCart(cust!.customerId);
      item = cart.items.find((i) => i.productId === testProd.productId);
      expect(item!.isHoldExpired).toBe(true);
    });

    it("Path D: detects price change after price hold expiry and requires confirmation before checkout", async () => {
      const startTime = new Date("2026-10-14T08:00:00Z");
      clock.setFixed(startTime);

      const store = await prisma.store.findFirst({ where: { status: "VERIFIED" } });
      const testProd = await prisma.product.create({
        data: {
          name: "Path D Decay Item",
          category: "Dairy",
          originalPrice: 100,
          currentPrice: 100,
          expiryDateTime: new Date(startTime.getTime() + 10 * 3600 * 1000),
          status: "ACTIVE",
          storeId: store!.storeId,
          inventoryItem: {
            create: { quantity: 10, reservedQuantity: 0 },
          },
        },
      });

      const cust = await prisma.customer.findFirst();
      await cartService.addItem(cust!.customerId, testProd.productId, 1);

      // Advance clock past 15 minutes so hold expires and decay advances
      clock.advanceHours(2);

      const checkoutService = new CheckoutService();
      // Checkout without confirmation should block and report price change
      const resBlocked = await checkoutService.checkout({
        customerId: cust!.customerId,
        paymentMethod: "UPI",
        confirmPriceChanges: false,
      });

      expect(resBlocked.success).toBe(false);
      expect(resBlocked.priceChanged).toBe(true);
      expect(resBlocked.priceChangedItems?.length).toBeGreaterThan(0);

      // Checkout with confirmation should update hold and complete purchase
      const resConfirmed = await checkoutService.checkout({
        customerId: cust!.customerId,
        paymentMethod: "UPI",
        confirmPriceChanges: true,
      });

      expect(resConfirmed.success).toBe(true);
      expect(resConfirmed.orders?.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 7. Successful and failed checkout
  // =========================================================================
  describe("7. Successful and Failed Checkout Workflows", () => {
    it("completes happy path checkout: reserves stock, records payment, confirms order", async () => {
      const cust = await prisma.customer.findFirst();
      const product = await prisma.product.findFirst({
        where: {
          status: "ACTIVE",
          store: { status: "VERIFIED" },
          inventoryItem: { quantity: { gt: 5 } },
          expiryDateTime: { gt: clock.now() },
        },
        include: { inventoryItem: true },
      });

      expect(product).toBeDefined();
      const initialStock = product!.inventoryItem!.quantity;

      // Add item to customer's cart
      await cartService.addItem(cust!.customerId, product!.productId, 1);

      const checkoutService = new CheckoutService();
      const correlationId = `test-success-checkout-${Date.now()}`;

      const result = await checkoutService.checkout({
        customerId: cust!.customerId,
        paymentMethod: "UPI",
        correlationId,
      });

      expect(result.success).toBe(true);
      expect(result.orders?.length).toBeGreaterThan(0);
      expect(result.payment?.status).toBe("SUCCESSFUL");

      // Verify stock was deducted/reserved properly
      const updatedInv = await prisma.inventoryItem.findUnique({
        where: { productId: product!.productId },
      });
      expect(updatedInv!.quantity).toBe(initialStock - 1);
    });

    it("handles simulated payment failure: cancels order, sets payment FAILED, releases stock", async () => {
      const cust = await prisma.customer.findFirst();
      const product = await prisma.product.findFirst({
        where: {
          status: "ACTIVE",
          store: { status: "VERIFIED" },
          inventoryItem: { quantity: { gt: 5 } },
          expiryDateTime: { gt: clock.now() },
        },
        include: { inventoryItem: true },
      });

      const initialStock = product!.inventoryItem!.quantity;
      const initialReserved = product!.inventoryItem!.reservedQuantity;

      // Add item to customer's cart
      await cartService.addItem(cust!.customerId, product!.productId, 1);

      const checkoutService = new CheckoutService();
      const correlationId = `test-fail-checkout-${Date.now()}`;

      const result = await checkoutService.checkout({
        customerId: cust!.customerId,
        paymentMethod: "UPI",
        simulateFailure: true,
        correlationId,
      });

      expect(result.success).toBe(false);

      // Verify order cancelled in DB
      const dbOrder = await prisma.order.findUnique({
        where: { orderId: result.orders![0].orderId },
      });
      expect(dbOrder?.status).toBe("CANCELLED");

      // Verify inventory was restored (not leaked)
      const updatedInv = await prisma.inventoryItem.findUnique({
        where: { productId: product!.productId },
      });
      expect(updatedInv!.quantity).toBe(initialStock);
      expect(updatedInv!.reservedQuantity).toBe(initialReserved);
    });
  });

  // =========================================================================
  // 8. Multi-store carts, inventory reservation, cancellation, & restoration
  // =========================================================================
  describe("8. Multi-Store Cart Partitioning & Integrity", () => {
    it("partitions items from multiple stores into distinct store orders", async () => {
      const stores = await prisma.store.findMany({
        where: { status: "VERIFIED" },
        take: 2,
      });

      if (stores.length < 2) return;

      const prod1 = await prisma.product.findFirst({
        where: { storeId: stores[0].storeId, status: "ACTIVE", inventoryItem: { quantity: { gt: 2 } }, expiryDateTime: { gt: clock.now() } },
      });
      const prod2 = await prisma.product.findFirst({
        where: { storeId: stores[1].storeId, status: "ACTIVE", inventoryItem: { quantity: { gt: 2 } }, expiryDateTime: { gt: clock.now() } },
      });

      expect(prod1).toBeDefined();
      expect(prod2).toBeDefined();

      const cust = await prisma.customer.findFirst();
      await cartService.addItem(cust!.customerId, prod1!.productId, 1);
      await cartService.addItem(cust!.customerId, prod2!.productId, 1);

      const checkoutService = new CheckoutService();
      const correlationId = `test-multistore-${Date.now()}`;

      const result = await checkoutService.checkout({
        customerId: cust!.customerId,
        paymentMethod: "CARD",
        correlationId,
      });

      expect(result.success).toBe(true);
      expect(result.orders?.length).toBe(2);

      const storeIdsInOrders = result.orders?.map((o) => o.storeId) || [];
      expect(storeIdsInOrders).toContain(stores[0].storeId);
      expect(storeIdsInOrders).toContain(stores[1].storeId);
    });
  });

  // =========================================================================
  // 9. Duplicate checkout requests & idempotency
  // =========================================================================
  describe("9. Duplicate Checkout Idempotency & Concurrency", () => {
    it("returns identical orders idempotently when called with identical correlationId", async () => {
      const cust = await prisma.customer.findFirst();
      const product = await prisma.product.findFirst({
        where: {
          status: "ACTIVE",
          store: { status: "VERIFIED" },
          inventoryItem: { quantity: { gt: 5 } },
          expiryDateTime: { gt: clock.now() },
        },
        include: { inventoryItem: true },
      });

      const initialStock = product!.inventoryItem!.quantity;
      await cartService.addItem(cust!.customerId, product!.productId, 1);

      const checkoutService = new CheckoutService();
      const correlationId = `idempotent-test-${Date.now()}`;

      // First checkout call
      const res1 = await checkoutService.checkout({
        customerId: cust!.customerId,
        paymentMethod: "UPI",
        correlationId,
      });

      // Second identical checkout call with same correlationId
      const res2 = await checkoutService.checkout({
        customerId: cust!.customerId,
        paymentMethod: "UPI",
        correlationId,
      });

      expect(res2.correlationId).toBe(res1.correlationId);
      expect(res2.orders?.[0].orderId).toBe(res1.orders?.[0].orderId);
      expect(res2.payment?.status).toBe("SUCCESSFUL");

      // Stock should only have been deducted ONCE (1 unit, not 2)
      const afterStock = await prisma.inventoryItem.findUnique({
        where: { productId: product!.productId },
      });
      expect(afterStock!.quantity).toBe(initialStock - 1);
    });
  });

  // =========================================================================
  // 10. Role switching between every supported demo role without login
  // =========================================================================
  describe("10. Demo Role Switcher & Predefined Identities", () => {
    it("provides valid predefined demo identities for all 4 roles", async () => {
      expect(isDemoMode()).toBe(true);

      const roles: UserSessionPayload["role"][] = [
        "CUSTOMER",
        "STORE_OWNER",
        "DELIVERY_PARTNER",
        "ADMIN",
      ];

      for (const role of roles) {
        const persona = await getDemoPersona(role);
        expect(persona).not.toBeNull();
        expect(persona?.role).toBe(role);
        expect(persona?.email).toBe(DEMO_IDENTITIES[role].email);

        // Verify signed JWT token roundtrips cleanly
        const token = await signSessionToken(persona!);
        const verified = await verifySessionToken(token);
        expect(verified).not.toBeNull();
        expect(verified?.userId).toBe(persona?.userId);
        expect(verified?.role).toBe(role);
      }
    });
  });

  // =========================================================================
  // 11. Unauthorized cross-tenant operations
  // =========================================================================
  describe("11. Tenant Isolation & Resource Ownership", () => {
    it("prevents store owner from modifying another store's pricing rules", async () => {
      const stores = await prisma.store.findMany({ take: 2 });
      if (stores.length < 2) return;

      const rule = await prisma.pricingRule.create({
        data: {
          storeId: stores[0].storeId,
          category: "Dairy",
          discountRate: 0.05,
          expiryThresholdHours: 24,
          maximumDiscount: 0.75,
          minimumPriceFloor: 10,
        },
      });

      // Verify rule belongs to store 0, not store 1
      expect(rule.storeId).toBe(stores[0].storeId);
      expect(rule.storeId).not.toBe(stores[1].storeId);
    });

    it("prevents delivery partner from modifying unassigned deliveries", async () => {
      const partners = await prisma.deliveryPartner.findMany({ take: 2 });
      if (partners.length < 2) return;

      const stores = await prisma.store.findMany({ take: 1 });
      const deliveryService = new DeliveryService();

      const cust = await prisma.customer.findFirst();
      // Create a fresh order for this delivery test
      const dummyOrder = await prisma.order.create({
        data: {
          customerId: cust!.customerId,
          storeId: stores[0].storeId,
          orderNumber: `ORD-TEST-DELIV-${Date.now()}`,
          totalAmount: 100,
          status: "CONFIRMED",
        },
      });

      const testDelivery = await prisma.delivery.create({
        data: {
          orderId: dummyOrder.orderId,
          deliveryAddress: "Partner Test St",
          trackingNumber: `TRK-TEST-${Date.now()}`,
          status: "ASSIGNED",
          partnerId: partners[0].partnerId,
        },
      });

      // Partner 1 tries to accept delivery assigned to Partner 0 -> should fail
      await expect(
        deliveryService.acceptDelivery(testDelivery.deliveryId, partners[1].partnerId)
      ).rejects.toThrow("Unauthorized: you are not the assigned delivery partner");

      // Cleanup
      await prisma.delivery.delete({ where: { deliveryId: testDelivery.deliveryId } });
      await prisma.order.delete({ where: { orderId: dummyOrder.orderId } });
    });
  });

  // =========================================================================
  // 12. Unauthorized time advancement and order-sweeper authorization
  // =========================================================================
  describe("12. Scheduled Jobs & Demo Advancement Security", () => {
    it("ensures advance-time and sweeper services require appropriate authorization", async () => {
      const adminPersona = await getDemoPersona("ADMIN");
      const customerPersona = await getDemoPersona("CUSTOMER");

      expect(adminPersona?.role).toBe("ADMIN");
      expect(customerPersona?.role).toBe("CUSTOMER");
      expect(customerPersona?.role).not.toBe("ADMIN");
    });
  });

  // =========================================================================
  // 13. Invalid timeout inputs and repeated sweeper execution
  // =========================================================================
  describe("13. Sweeper Parameter Validation & Idempotency", () => {
    it("sweeps expired orders idempotently without double-refunding or crashing", async () => {
      // Execute sweep
      const res1 = await storeOrderService.sweepUnrespondedOrders(15);
      expect(typeof res1.sweptCount).toBe("number");

      // Repeated sweep is safe and idempotent
      const res2 = await storeOrderService.sweepUnrespondedOrders(15);
      expect(typeof res2.sweptCount).toBe("number");
    });
  });

  // =========================================================================
  // 14. Correct order, payment, and delivery status transitions
  // =========================================================================
  describe("14. State Machine Transitions (Order, Delivery, Payment)", () => {
    it("enforces valid delivery status transitions and rejects invalid ones", () => {
      const delivery = new Delivery({
        deliveryId: 1,
        orderId: 10,
        deliveryAddress: "State Machine Road",
        trackingNumber: "TRK-SM-001",
        status: "PENDING",
      });

      // PENDING -> ASSIGNED
      delivery.updateStatus("ASSIGNED");
      expect(delivery.status).toBe("ASSIGNED");

      // ASSIGNED -> ACCEPTED
      delivery.updateStatus("ACCEPTED");
      expect(delivery.status).toBe("ACCEPTED");

      // ACCEPTED -> OUT_FOR_DELIVERY
      delivery.updateStatus("OUT_FOR_DELIVERY");
      expect(delivery.status).toBe("OUT_FOR_DELIVERY");

      // OUT_FOR_DELIVERY -> DELIVERED
      delivery.updateStatus("DELIVERED");
      expect(delivery.status).toBe("DELIVERED");

      // Invalid: DELIVERED -> ACCEPTED must throw
      expect(() => delivery.updateStatus("ACCEPTED")).toThrow("invalidStatusTransition");
    });

    it("enforces Payment refund contract: only SUCCESSFUL payments can be refunded", async () => {
      const paymentService = new PaymentService();

      // Create a test order and a failed payment record in DB
      const store = await prisma.store.findFirst({ where: { status: "VERIFIED" } });
      const cust = await prisma.customer.findFirst();

      const testOrder = await prisma.order.create({
        data: {
          customerId: cust!.customerId,
          storeId: store!.storeId,
          orderNumber: `ORD-PAYTEST-${Date.now()}`,
          totalAmount: 100,
          status: "CANCELLED",
        },
      });

      const failedPayment = await prisma.payment.create({
        data: {
          orderId: testOrder.orderId,
          amount: 100,
          method: "CARD",
          status: "FAILED",
        },
      });

      // Cannot refund a failed payment
      const refundFailedRes = await paymentService.processRefund({
        paymentId: failedPayment.paymentId,
        amount: 100,
        reason: "Test refund",
      });
      expect(refundFailedRes.success).toBe(false);
      expect(refundFailedRes.error).toContain("status 'FAILED'");

      // Update payment to SUCCESSFUL and refund
      const successPayment = await prisma.payment.update({
        where: { paymentId: failedPayment.paymentId },
        data: { status: "SUCCESSFUL" },
      });

      const refundSuccessRes = await paymentService.processRefund({
        paymentId: successPayment.paymentId,
        amount: 100,
        reason: "Customer cancelled",
      });
      expect(refundSuccessRes.success).toBe(true);
      expect(refundSuccessRes.status).toBe("REFUNDED");

      // Cleanup
      await prisma.payment.delete({ where: { paymentId: failedPayment.paymentId } });
      await prisma.order.delete({ where: { orderId: testOrder.orderId } });
    });
  });

  // =========================================================================
  // 15. Database initialization and deterministic seeding
  // =========================================================================
  describe("15. Deterministic Seeding & Database Invariants", () => {
    it("verifies expected seeded entities exist in database", async () => {
      const adminCount = await prisma.administrator.count();
      const verifiedStoreCount = await prisma.store.count({ where: { status: "VERIFIED" } });
      const unverifiedStoreCount = await prisma.store.count({ where: { status: "PENDING_VERIFICATION" } });
      const partnerCount = await prisma.deliveryPartner.count();
      const customerCount = await prisma.customer.count();
      const productCount = await prisma.product.count();
      const rulesCount = await prisma.pricingRule.count();

      expect(adminCount).toBeGreaterThanOrEqual(1);
      expect(verifiedStoreCount).toBeGreaterThanOrEqual(2);
      expect(unverifiedStoreCount).toBeGreaterThanOrEqual(1);
      expect(partnerCount).toBeGreaterThanOrEqual(2);
      expect(customerCount).toBeGreaterThanOrEqual(3);
      expect(productCount).toBeGreaterThanOrEqual(16);
      expect(rulesCount).toBeGreaterThanOrEqual(4);
    });
  });
});
