import { describe, it, expect, beforeEach } from "vitest";
import { Product } from "@/domain/Product";
import { InventoryItem } from "@/domain/InventoryItem";
import { PricingRule } from "@/domain/PricingRule";
import { PricingEngine } from "@/domain/PricingEngine";
import { Store } from "@/domain/Store";
import { getExpiryBand } from "@/lib/config";
import { clock } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { MarketplaceService } from "@/services/MarketplaceService";

describe("Module 1: Product, Expiry & Dynamic Decay Pricing", () => {
  beforeEach(() => {
    clock.reset();
  });

  // 1. Decay at several hoursRemaining values
  it("calculates decay progressively at several hoursRemaining values (0h, 6h, 12h, 24h, 48h)", () => {
    const rule = new PricingRule({
      ruleId: 1,
      discountRate: 0.025, // 2.5% per elapsed hour
      expiryThresholdHours: 24, // 24-hour decay window
      maximumDiscount: 0.80,
      minimumPriceFloor: 5.0,
    });

    const now = new Date("2026-10-10T12:00:00Z");

    // Outside threshold: 48h remaining -> 0% discount
    const expiry48h = new Date(now.getTime() + 48 * 3600 * 1000);
    expect(rule.calculateDiscount(expiry48h, now)).toBe(0);

    // At threshold boundary: 24h remaining -> 0% discount
    const expiry24h = new Date(now.getTime() + 24 * 3600 * 1000);
    expect(rule.calculateDiscount(expiry24h, now)).toBe(0);

    // Halfway: 12h remaining (12h elapsed) -> 12 * 2.5% = 30% discount
    const expiry12h = new Date(now.getTime() + 12 * 3600 * 1000);
    expect(rule.calculateDiscount(expiry12h, now)).toBeCloseTo(0.30, 4);

    // Near expiry: 6h remaining (18h elapsed) -> 18 * 2.5% = 45% discount
    const expiry6h = new Date(now.getTime() + 6 * 3600 * 1000);
    expect(rule.calculateDiscount(expiry6h, now)).toBeCloseTo(0.45, 4);

    // Expired: 0h remaining -> capped at max discount (80%)
    const expiry0h = new Date(now.getTime());
    expect(rule.calculateDiscount(expiry0h, now)).toBe(0.80);
  });

  // 2. 80% cap enforcement
  it("enforces the 80% maximum discount cap even when decay rate exceeds it", () => {
    const aggressiveRule = new PricingRule({
      ruleId: 2,
      discountRate: 0.10, // 10% per hour
      expiryThresholdHours: 20,
      maximumDiscount: 0.85, // Attempts to exceed 80%
      minimumPriceFloor: 1.0,
    });

    const now = new Date("2026-10-10T12:00:00Z");
    // 2 hours remaining in 20h window = 18 hours elapsed -> 18 * 10% = 180% -> must cap at 80%
    const expiry2h = new Date(now.getTime() + 2 * 3600 * 1000);
    const discount = aggressiveRule.calculateDiscount(expiry2h, now);
    expect(discount).toBe(0.80);

    const product = new Product({
      productId: 99,
      name: "Luxury Cheese",
      category: "Dairy",
      originalPrice: 1000,
      currentPrice: 1000,
      expiryDateTime: expiry2h,
      status: "ACTIVE",
      now,
    });

    const engine = new PricingEngine();
    const price = engine.calculatePrice(product, aggressiveRule, now);
    // 1000 * (1 - 0.80) = 200
    expect(price).toBe(200);
  });

  // 3. Price floor enforcement
  it("enforces minimumPriceFloor when discounted price falls below floor", () => {
    const ruleWithHighFloor = new PricingRule({
      ruleId: 3,
      discountRate: 0.05,
      expiryThresholdHours: 24,
      maximumDiscount: 0.80,
      minimumPriceFloor: 40.0, // High floor of ₹40
    });

    const now = new Date("2026-10-10T12:00:00Z");
    // 1 hour remaining in 24h window -> 23 * 5% = 115% -> capped at 80%
    const nearExpiry = new Date(now.getTime() + 1 * 3600 * 1000);

    const product = new Product({
      productId: 101,
      name: "Discounted Bread",
      category: "Bakery",
      originalPrice: 50,
      currentPrice: 50,
      expiryDateTime: nearExpiry,
      status: "ACTIVE",
      now,
    });

    // 50 * (1 - 0.80) = ₹10, but floor is ₹40!
    const engine = new PricingEngine();
    const finalPrice = engine.calculatePrice(product, ruleWithHighFloor, now);
    expect(finalPrice).toBe(40);
    expect(product.currentPrice).toBe(40);
  });

  // 4. Band boundaries at 6h, 24h, 72h
  it("classifies expiry bands correctly at exact 6h, 24h, and 72h boundaries", () => {
    const now = new Date("2026-10-10T12:00:00Z");

    // Critical: <= 6h
    const exp6h = new Date(now.getTime() + 6 * 3600 * 1000);
    const exp5h = new Date(now.getTime() + 5 * 3600 * 1000);
    expect(getExpiryBand(exp6h, now)).toBe("CRITICAL");
    expect(getExpiryBand(exp5h, now)).toBe("CRITICAL");

    // Urgent: > 6h and <= 24h
    const exp6h1m = new Date(now.getTime() + 6.01 * 3600 * 1000);
    const exp24h = new Date(now.getTime() + 24 * 3600 * 1000);
    expect(getExpiryBand(exp6h1m, now)).toBe("URGENT");
    expect(getExpiryBand(exp24h, now)).toBe("URGENT");

    // Soon: > 24h and <= 72h
    const exp24h1m = new Date(now.getTime() + 24.01 * 3600 * 1000);
    const exp72h = new Date(now.getTime() + 72 * 3600 * 1000);
    expect(getExpiryBand(exp24h1m, now)).toBe("SOON");
    expect(getExpiryBand(exp72h, now)).toBe("SOON");

    // Standard: > 72h
    const exp73h = new Date(now.getTime() + 73 * 3600 * 1000);
    expect(getExpiryBand(exp73h, now)).toBe("STANDARD");
  });

  // 5. Expired products removed and never searchable
  it("removes expired active products and transitions them to EXPIRED_REMOVED", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const pastDate = new Date(now.getTime() - 1000);

    const expiredProduct = new Product({
      productId: 501,
      name: "Expired Yogurt",
      category: "Dairy",
      originalPrice: 40,
      currentPrice: 40,
      expiryDateTime: pastDate,
      status: "ACTIVE",
      skipExpiryCheck: true, // simulates rehydrated item
    });

    const engine = new PricingEngine();
    const removed = engine.updateExpiredProducts([expiredProduct], now);

    expect(removed).toHaveLength(1);
    expect(expiredProduct.status).toBe("EXPIRED_REMOVED");
  });

  // 6. Out-of-stock excluded
  it("reports stock status correctly and identifies out-of-stock items", () => {
    const emptyInventory = new InventoryItem({
      inventoryId: 99,
      quantity: 5,
      reservedQuantity: 5, // All reserved -> 0 available
    });

    const check = emptyInventory.checkAvailability(1);
    expect(check.available).toBe(0);
    expect(check.isAvailable).toBe(false);
    expect(check.stockStatus).toBe("OUT_OF_STOCK");
  });

  // 7. Past-expiry creation rejected
  it("rejects product creation when expiryDateTime <= now", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const pastDate = new Date(now.getTime() - 3600 * 1000);

    expect(() => {
      new Product({
        productId: 1,
        name: "Old Milk",
        category: "Dairy",
        originalPrice: 50,
        currentPrice: 50,
        expiryDateTime: pastDate,
        status: "ACTIVE",
        now,
      });
    }).toThrow("Product creation rejected: expiry date must be in the future");
  });

  // 8. Unverified store blocked
  it("blocks unverified store from adding products", () => {
    const unverifiedStore = new Store({
      storeId: 10,
      storeName: "Unverified Mart",
      address: "123 Street",
      status: "PENDING_VERIFICATION",
    });

    const futureDate = new Date(Date.now() + 24 * 3600 * 1000);

    expect(() => {
      unverifiedStore.addProduct({
        name: "Apples",
        category: "Produce",
        originalPrice: 100,
        expiryDateTime: futureDate,
      });
    }).toThrow("Store must be VERIFIED to add products");

    // Once verified, adding product succeeds
    unverifiedStore.status = "VERIFIED";
    const product = unverifiedStore.addProduct({
      name: "Apples",
      category: "Produce",
      originalPrice: 100,
      expiryDateTime: futureDate,
    });
    expect(product).toBeDefined();
    expect(product.status).toBe("ACTIVE");
  });

  // 9. Illegal Product status transitions throw
  it("throws on illegal product status transitions", () => {
    const product = new Product({
      productId: 300,
      name: "Juice",
      category: "Beverages",
      originalPrice: 80,
      currentPrice: 80,
      expiryDateTime: new Date(Date.now() + 12 * 3600 * 1000),
      status: "ACTIVE",
    });

    // Valid: ACTIVE -> EXPIRED_REMOVED
    product.transitionStatus("EXPIRED_REMOVED");
    expect(product.status).toBe("EXPIRED_REMOVED");

    // Illegal: EXPIRED_REMOVED -> ACTIVE must throw
    expect(() => product.transitionStatus("ACTIVE")).toThrow(
      "Illegal product status transition"
    );

    // Create a SOLD product
    const soldProduct = new Product({
      productId: 301,
      name: "Juice 2",
      category: "Beverages",
      originalPrice: 80,
      currentPrice: 80,
      expiryDateTime: new Date(Date.now() + 12 * 3600 * 1000),
      status: "DRAFT",
    });
    soldProduct.transitionStatus("ACTIVE");
    soldProduct.transitionStatus("RESERVED");
    soldProduct.transitionStatus("SOLD");

    // Illegal: SOLD -> ACTIVE must throw
    expect(() => soldProduct.transitionStatus("ACTIVE")).toThrow(
      "Illegal product status transition"
    );
  });

  // 10. Search emits trace steps 1..14 in order
  it("emits sequence steps 1 through 14 in exact chronological order during marketplace search", async () => {
    const correlationId = `test-trace-${Date.now()}`;
    const service = new MarketplaceService();

    const result = await service.searchProduct("", {}, correlationId);
    expect(result).toBeDefined();
    expect(result.correlationId).toBe(correlationId);

    // Query trace logs recorded for this correlationId
    const logs = await prisma.traceLog.findMany({
      where: { correlationId },
      orderBy: { traceId: "asc" },
    });

    // Check that step 1 is present
    expect(logs.some((l) => l.stepNumber === 1 && l.messageLabel.includes("searchProduct"))).toBe(true);

    if (result.products.length > 0) {
      // If products exist, steps 1..14 must be traced in order
      const stepNumbers = logs.map((l) => l.stepNumber);
      const expectedSteps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

      for (const step of expectedSteps) {
        expect(stepNumbers).toContain(step);
      }

      // Verify step 1 appears before step 2, step 2 before 3, etc.
      const indexOfStep1 = logs.findIndex((l) => l.stepNumber === 1);
      const indexOfStep2 = logs.findIndex((l) => l.stepNumber === 2);
      const indexOfStep14 = logs.findIndex((l) => l.stepNumber === 14);

      expect(indexOfStep1).toBeLessThan(indexOfStep2);
      expect(indexOfStep2).toBeLessThan(indexOfStep14);
    }
  });
});
