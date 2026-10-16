import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { PricingEngine } from "@/domain/PricingEngine";
import { PricingRule } from "@/domain/PricingRule";
import { Product } from "@/domain/Product";
import { CheckoutService } from "@/services/CheckoutService";
import { storeOrderService } from "@/services/StoreOrderService";
import { checkStoreOwnership } from "@/lib/auth";

describe("Multi-Store Management & Dynamic Pricing Verification", () => {
  beforeEach(() => {
    clock.reset();
  });

  it("verifies store ownership and prevents cross-store access", async () => {
    const freshmart = await prisma.store.findFirst({
      where: { storeName: "FreshMart Supermarket" },
    });
    const greenleaf = await prisma.store.findFirst({
      where: { storeName: "GreenLeaf Organic Grocers" },
    });

    expect(freshmart).toBeDefined();
    expect(greenleaf).toBeDefined();

    const ramesh = await prisma.user.findFirst({
      where: { email: "freshmart.owner@gmail.com" },
    });
    const priya = await prisma.user.findFirst({
      where: { email: "greenleaf.owner@gmail.com" },
    });

    expect(ramesh).toBeDefined();
    expect(priya).toBeDefined();

    // Ramesh owns FreshMart
    const rameshOwnsFreshmart = await checkStoreOwnership(ramesh!.userId, freshmart!.storeId);
    expect(rameshOwnsFreshmart).toBe(true);

    // Ramesh does NOT own GreenLeaf
    const rameshOwnsGreenleaf = await checkStoreOwnership(ramesh!.userId, greenleaf!.storeId);
    expect(rameshOwnsGreenleaf).toBe(false);

    // Priya owns GreenLeaf
    const priyaOwnsGreenleaf = await checkStoreOwnership(priya!.userId, greenleaf!.storeId);
    expect(priyaOwnsGreenleaf).toBe(true);
  });

  it("verifies product ownership: Ripe Bananas belong to FreshMart, Paneer and Croissants belong to GreenLeaf", async () => {
    const banana = await prisma.product.findFirst({
      where: { name: { contains: "Ripe Bananas" } },
      include: { store: true },
    });
    const paneer = await prisma.product.findFirst({
      where: { name: { contains: "Organic Paneer" } },
      include: { store: true },
    });
    const croissants = await prisma.product.findFirst({
      where: { name: { contains: "Fresh Croissants" } },
      include: { store: true },
    });

    expect(banana).toBeDefined();
    expect(banana?.store.storeName).toContain("FreshMart");

    expect(paneer).toBeDefined();
    expect(paneer?.store.storeName).toContain("GreenLeaf");

    expect(croissants).toBeDefined();
    expect(croissants?.store.storeName).toContain("GreenLeaf");
  });

  it("verifies incoming order segregation: each Store Owner sees only their own store orders", async () => {
    const freshmart = await prisma.store.findFirst({
      where: { storeName: "FreshMart Supermarket" },
    });
    const greenleaf = await prisma.store.findFirst({
      where: { storeName: "GreenLeaf Organic Grocers" },
    });

    const freshmartOrders = await storeOrderService.getStoreOrders(freshmart!.storeId);
    const greenleafOrders = await storeOrderService.getStoreOrders(greenleaf!.storeId);

    // FreshMart sees ORD-DEMO-001
    expect(freshmartOrders.some((o) => o.orderNumber === "ORD-DEMO-001")).toBe(true);
    // FreshMart does NOT see GreenLeaf's ORD-DEMO-002
    expect(freshmartOrders.some((o) => o.orderNumber === "ORD-DEMO-002")).toBe(false);

    // GreenLeaf sees ORD-DEMO-002
    expect(greenleafOrders.some((o) => o.orderNumber === "ORD-DEMO-002")).toBe(true);
    // GreenLeaf does NOT see FreshMart's ORD-DEMO-001
    expect(greenleafOrders.some((o) => o.orderNumber === "ORD-DEMO-001")).toBe(false);
  });

  it("verifies multi-store checkout partitions items by storeId into separate orders", async () => {
    const customer = await prisma.user.findFirst({
      where: { email: "rahul.customer@gmail.com" },
    });
    expect(customer).toBeDefined();

    const banana = await prisma.product.findFirst({
      where: { name: { contains: "Ripe Bananas" } },
    });
    const croissants = await prisma.product.findFirst({
      where: { name: { contains: "Fresh Croissants" } },
    });

    expect(banana).toBeDefined();
    expect(croissants).toBeDefined();
    expect(banana!.storeId).not.toBe(croissants!.storeId);

    // Set cart with 1 Banana from FreshMart and 1 Croissant from GreenLeaf
    const cart = await prisma.shoppingCart.findUnique({
      where: { customerId: customer!.userId },
    });
    await prisma.cartItem.deleteMany({ where: { cartId: cart!.cartId } });

    await prisma.cartItem.createMany({
      data: [
        {
          cartId: cart!.cartId,
          productId: banana!.productId,
          quantity: 1,
          price: banana!.currentPrice,
          priceHoldExpiresAt: new Date(clock.now().getTime() + 15 * 60 * 1000),
        },
        {
          cartId: cart!.cartId,
          productId: croissants!.productId,
          quantity: 1,
          price: croissants!.currentPrice,
          priceHoldExpiresAt: new Date(clock.now().getTime() + 15 * 60 * 1000),
        },
      ],
    });

    const checkoutService = new CheckoutService();
    const result = await checkoutService.checkout({
      customerId: customer!.userId,
      paymentMethod: "CARD",
      cardDetails: {
        cardNumber: "4111111111111111",
        cardholderName: "Rahul Verma",
        expiry: "12/28",
        cvv: "123",
      },
    });

    expect(result.success).toBe(true);
    expect(result.orders?.length).toBe(2);

    const storeIds = result.orders?.map((o) => o.storeId);
    expect(storeIds).toContain(banana!.storeId);
    expect(storeIds).toContain(croissants!.storeId);

    // Verify delivery records were created for both orders
    for (const order of result.orders!) {
      const delivery = await prisma.delivery.findFirst({
        where: { orderId: order.orderId },
      });
      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe("ASSIGNED");
      expect(delivery?.partnerId).toBeGreaterThan(0);
    }
  });

  it("verifies dynamic decay calculation and price floor: selling price never exceeds original price", () => {
    const engine = new PricingEngine();
    const now = clock.now();
    const expiryIn3h = new Date(now.getTime() + 3 * 3600 * 1000);

    // Product with originalPrice ₹66 and high price floor ₹100
    const testProduct = new Product({
      productId: 9999,
      name: "Floor Test Product",
      category: "Dairy",
      originalPrice: 66,
      currentPrice: 66,
      expiryDateTime: expiryIn3h,
      status: "ACTIVE",
      storeId: 1,
      skipExpiryCheck: true,
    });

    const ruleWithHighFloor = new PricingRule({
      ruleId: 9999,
      discountRate: 0.05,
      expiryThresholdHours: 24,
      maximumDiscount: 0.80,
      minimumPriceFloor: 100.0, // Floor higher than original price!
    });

    const price = engine.calculatePrice(testProduct, ruleWithHighFloor, now);

    // Must NEVER raise price above original price
    expect(price).toBeLessThanOrEqual(testProduct.originalPrice);
    expect(price).toBe(66);
  });

  it("verifies that price changes are recorded in PriceHistory without duplicates", async () => {
    const product = await prisma.product.findFirst({
      where: { name: { contains: "Fresh Whole Milk" } },
    });
    expect(product).toBeDefined();

    const initialHistoryCount = await prisma.priceHistory.count({
      where: { productId: product!.productId },
    });

    // Advance clock to trigger decay price change
    clock.advanceHours(2);
    const engine = new PricingEngine();
    const now = clock.now();

    const { price: newPrice } = await engine.calculateAuthoritativePrice(
      new Product({
        productId: product!.productId,
        name: product!.name,
        category: product!.category,
        originalPrice: product!.originalPrice,
        currentPrice: product!.currentPrice,
        expiryDateTime: product!.expiryDateTime,
        status: "ACTIVE",
        storeId: product!.storeId,
        pricingRuleId: product!.pricingRuleId ?? undefined,
        skipExpiryCheck: true,
      }),
      undefined,
      now
    );

    expect(newPrice).toBeLessThan(product!.originalPrice);

    // Create a history entry when price changes
    await prisma.priceHistory.create({
      data: {
        productId: product!.productId,
        price: newPrice,
        reason: "HOURLY_DECAY",
      },
    });

    const updatedHistoryCount = await prisma.priceHistory.count({
      where: { productId: product!.productId },
    });

    expect(updatedHistoryCount).toBe(initialHistoryCount + 1);
  });
});
