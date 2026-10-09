import { describe, it, expect } from "vitest";
import { Product } from "@/domain/Product";
import { Order } from "@/domain/Order";
import { OrderItem } from "@/domain/OrderItem";
import { ShoppingCart } from "@/domain/ShoppingCart";
import { CartItem } from "@/domain/CartItem";
import { PricingRule } from "@/domain/PricingRule";
import { PricingEngine } from "@/domain/PricingEngine";
import { InventoryItem } from "@/domain/InventoryItem";

describe("Product Domain Model", () => {
  it("enforces valid status transitions and throws on illegal transitions", () => {
    const product = new Product({
      productId: 1,
      name: "Organic Milk",
      category: "Dairy",
      originalPrice: 60,
      currentPrice: 60,
      expiryDateTime: new Date(Date.now() + 10 * 3600 * 1000),
      status: "DRAFT",
    });

    // Valid transition: DRAFT -> ACTIVE
    product.transitionStatus("ACTIVE");
    expect(product.status).toBe("ACTIVE");

    // Valid transition: ACTIVE -> RESERVED
    product.transitionStatus("RESERVED");
    expect(product.status).toBe("RESERVED");

    // Valid transition: RESERVED -> SOLD
    product.transitionStatus("SOLD");
    expect(product.status).toBe("SOLD");

    // Illegal transition: SOLD -> ACTIVE must throw
    expect(() => product.transitionStatus("ACTIVE")).toThrow(
      "Illegal product status transition"
    );
  });

  it("updates price rounding to whole rupees and rejects negative price", () => {
    const product = new Product({
      productId: 2,
      name: "Bread",
      category: "Bakery",
      originalPrice: 50,
      currentPrice: 50,
      expiryDateTime: new Date(Date.now() + 24 * 3600 * 1000),
      status: "ACTIVE",
    });

    product.updatePrice(37.4);
    expect(product.currentPrice).toBe(37);

    product.updatePrice(37.6);
    expect(product.currentPrice).toBe(38);

    expect(() => product.updatePrice(-5)).toThrow("cannot be negative");
  });
});

describe("Order Domain Model", () => {
  it("enforces order lifecycle transitions and cancellation rules", () => {
    const order = new Order({
      orderId: 101,
      totalAmount: 150,
      status: "PLACED",
    });

    // Valid: PLACED -> CONFIRMED
    order.confirmOrder();
    expect(order.status).toBe("CONFIRMED");

    // Valid: CONFIRMED -> PREPARING
    order.updateStatus("PREPARING");
    expect(order.status).toBe("PREPARING");

    // Cannot cancel when PREPARING (per BR-6 / FR-OM-7: only PLACED or CONFIRMED)
    expect(() => order.cancelOrder()).toThrow("Cannot cancel order in status 'PREPARING'");

    // Valid: PREPARING -> OUT_FOR_DELIVERY -> DELIVERED
    order.updateStatus("OUT_FOR_DELIVERY");
    order.updateStatus("DELIVERED");
    expect(order.status).toBe("DELIVERED");

    // Illegal: DELIVERED -> PLACED
    expect(() => order.updateStatus("PLACED")).toThrow("Illegal order status transition");
  });
});

describe("OrderItem and ShoppingCart Subtotal & Total", () => {
  it("calculates OrderItem subtotal correctly", () => {
    const item = new OrderItem({
      orderItemId: 1,
      quantity: 3,
      unitPrice: 45,
    });
    expect(item.calculateSubtotal()).toBe(135);
  });

  it("calculates ShoppingCart total across multiple items", () => {
    const item1 = new CartItem({ cartItemId: 1, quantity: 2, price: 30 });
    const item2 = new CartItem({ cartItemId: 2, quantity: 1, price: 75 });

    const cart = new ShoppingCart({ cartId: 1, items: [item1, item2] });
    expect(cart.calculateTotal()).toBe(135);

    // After removing an item
    cart.removeItem(1);
    expect(cart.calculateTotal()).toBe(75);
  });
});

describe("PricingRule and PricingEngine Dynamic Decay Pricing", () => {
  it("decays price progressively within the threshold window and respects maximum cap", () => {
    const rule = new PricingRule({
      ruleId: 1,
      discountRate: 0.05, // 5% discount per elapsed hour
      expiryThresholdHours: 20,
      maximumDiscount: 0.70, // Max 70%
      minimumPriceFloor: 10,
    });

    const now = new Date("2026-10-01T12:00:00Z");

    // Case 1: Expiry 25 hours away (> 20h threshold) -> 0% discount
    const futureExpiry = new Date(now.getTime() + 25 * 3600 * 1000);
    expect(rule.calculateDiscount(futureExpiry, now)).toBe(0);

    // Case 2: Expiry 10 hours away (10 hours elapsed in 20h window) -> 10 * 5% = 50% discount
    const midExpiry = new Date(now.getTime() + 10 * 3600 * 1000);
    expect(rule.calculateDiscount(midExpiry, now)).toBeCloseTo(0.50, 4);

    // Case 3: Expiry 2 hours away (18 hours elapsed -> 18 * 5% = 90% -> capped at 70%)
    const nearExpiry = new Date(now.getTime() + 2 * 3600 * 1000);
    expect(rule.calculateDiscount(nearExpiry, now)).toBe(0.70);

    // PricingEngine computes price on product correctly
    const product = new Product({
      productId: 10,
      name: "Milk",
      category: "Dairy",
      originalPrice: 100,
      currentPrice: 100,
      expiryDateTime: midExpiry,
      status: "ACTIVE",
      now,
    });

    const engine = new PricingEngine();
    const calculatedPrice = engine.calculatePrice(product, rule, now);
    expect(calculatedPrice).toBe(50); // 100 * (1 - 0.50)
    expect(product.currentPrice).toBe(50);
  });
});

describe("InventoryItem Stock Lifecycle", () => {
  it("handles checkAvailability, reserveStock, reduceStock, and releaseReservedStock", () => {
    const item = new InventoryItem({
      inventoryId: 1,
      quantity: 10,
      reservedQuantity: 0,
    });

    const check1 = item.checkAvailability(5);
    expect(check1.isAvailable).toBe(true);
    expect(check1.available).toBe(10);
    expect(check1.stockStatus).toBe("IN_STOCK");

    const check2 = item.checkAvailability(11);
    expect(check2.isAvailable).toBe(false);
    expect(check2.available).toBe(10);

    // Reserve 4 units
    item.reserveStock(4);
    expect(item.reservedQuantity).toBe(4);
    expect(item.checkAvailability(7).isAvailable).toBe(false); // 10 - 4 = 6 available
    expect(item.checkAvailability(6).isAvailable).toBe(true);
    expect(item.checkAvailability().available).toBe(6);

    // Confirm payment and reduce 3 units
    item.reduceStock(3);
    expect(item.quantity).toBe(7);
    expect(item.reservedQuantity).toBe(1);

    // Release remaining 1 reserved unit
    item.releaseReservedStock(1);
    expect(item.quantity).toBe(7);
    expect(item.reservedQuantity).toBe(0);
  });
});

