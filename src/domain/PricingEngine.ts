import { Product } from "./Product";
import { PricingRule } from "./PricingRule";
import { clock } from "@/lib/clock";
import { trace } from "@/lib/trace";
import { prisma } from "@/lib/prisma";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";

export interface PricingTraceContext {
  correlationId: string;
}

export class PricingEngine {
  /**
   * Sequence Step 6 -> 13: calculateCurrentPrice(Product)
   * Flow inside calculatePrice:
   * 7/8: getExpiryDetails() (PricingEngine -> Product)
   * 9/10: PricingRule.calculateDiscount(expiryTime) (PricingEngine -> PricingRule)
   * floor and cap (Never exceed original price)
   * 11/12: Product.updatePrice(discountedPrice) only if changed
   * 13: return currentPrice
   */
  async calculatePriceWithTrace(
    product: Product,
    rule?: PricingRule,
    currentNow: Date = clock.now(),
    traceCtx?: PricingTraceContext
  ): Promise<number> {
    // Step 7: getExpiryDetails()
    if (traceCtx) {
      await trace.step({
        correlationId: traceCtx.correlationId,
        stepNumber: 7,
        label: "getExpiryDetails()",
        from: "PricingEngine",
        to: "Product",
        details: { productId: product.productId },
      });
    }

    // Step 8: expiryDateTime
    const expiry = product.getExpiryDetails();
    if (traceCtx) {
      await trace.step({
        correlationId: traceCtx.correlationId,
        stepNumber: 8,
        label: "expiryDateTime",
        from: "Product",
        to: "PricingEngine",
        details: { expiryDateTime: expiry.toISOString() },
      });
    }

    // Resolve active rule or fallback
    const activeRule = rule ?? (await this.resolveRuleForProduct(product));

    // Step 9: calculateDiscount(expiryTime)
    if (traceCtx) {
      await trace.step({
        correlationId: traceCtx.correlationId,
        stepNumber: 9,
        label: "calculateDiscount(expiryTime)",
        from: "PricingEngine",
        to: "PricingRule",
        details: {
          ruleId: activeRule.ruleId,
          expiryDateTime: expiry.toISOString(),
          now: currentNow.toISOString(),
        },
      });
    }

    // Step 10: discountRate
    const discountFraction = activeRule.calculateDiscount(expiry, currentNow);
    if (traceCtx) {
      await trace.step({
        correlationId: traceCtx.correlationId,
        stepNumber: 10,
        label: "discountRate",
        from: "PricingRule",
        to: "PricingEngine",
        details: {
          discountFraction,
          discountPercent: Math.round(discountFraction * 100),
        },
      });
    }

    // Floor and cap: Never raise price above originalPrice
    const rawDiscounted = product.originalPrice * (1 - discountFraction);
    const flooredPrice = Math.max(rawDiscounted, activeRule.minimumPriceFloor);
    const effectivePrice = Math.min(product.originalPrice, flooredPrice);
    const roundedPrice = Math.round(effectivePrice);

    // Step 11 & 12: updatePrice only if changed
    const previousPrice = product.currentPrice;
    if (previousPrice !== roundedPrice) {
      if (traceCtx) {
        await trace.step({
          correlationId: traceCtx.correlationId,
          stepNumber: 11,
          label: "updatePrice(discountedPrice)",
          from: "PricingEngine",
          to: "Product",
          details: { previousPrice, newPrice: roundedPrice },
        });
      }

      product.updatePrice(roundedPrice, "DECAY_CALCULATION");

      if (traceCtx) {
        await trace.step({
          correlationId: traceCtx.correlationId,
          stepNumber: 12,
          label: "priceUpdated",
          from: "Product",
          to: "PricingEngine",
          details: { currentPrice: product.currentPrice },
        });
      }
    } else {
      // Still log priceUpdated if in sequence trace for consistency
      if (traceCtx) {
        await trace.step({
          correlationId: traceCtx.correlationId,
          stepNumber: 11,
          label: "updatePrice(discountedPrice) [unchanged]",
          from: "PricingEngine",
          to: "Product",
          details: { currentPrice: product.currentPrice },
        });
        await trace.step({
          correlationId: traceCtx.correlationId,
          stepNumber: 12,
          label: "priceUpdated",
          from: "Product",
          to: "PricingEngine",
          details: { currentPrice: product.currentPrice },
        });
      }
    }

    // Step 13: currentPrice
    if (traceCtx) {
      await trace.step({
        correlationId: traceCtx.correlationId,
        stepNumber: 13,
        label: "currentPrice",
        from: "PricingEngine",
        to: "Marketplace",
        details: { currentPrice: product.currentPrice },
      });
    }

    return product.currentPrice;
  }

  /**
   * Synchronous / Domain method: calculatePrice(product, rule?, currentNow?)
   */
  calculatePrice(
    product: Product,
    rule?: PricingRule,
    currentNow: Date = clock.now()
  ): number {
    const expiry = product.getExpiryDetails();

    const activeRule =
      rule ??
      new PricingRule({
        ruleId: 0,
        discountRate: 0.025,
        expiryThresholdHours: 24,
        maximumDiscount: 0.8,
        minimumPriceFloor: 1.0,
      });

    const discountFraction = activeRule.calculateDiscount(expiry, currentNow);
    const rawDiscounted = product.originalPrice * (1 - discountFraction);
    const flooredPrice = Math.max(rawDiscounted, activeRule.minimumPriceFloor);
    // Never raise price above originalPrice because of floor
    const effectivePrice = Math.min(product.originalPrice, flooredPrice);

    const roundedPrice = Math.round(effectivePrice);
    if (product.currentPrice !== roundedPrice) {
      product.updatePrice(roundedPrice, "HOURLY_DECAY");
    }
    return product.currentPrice;
  }

  /**
   * Resolves the applicable pricing rule for a product:
   * 1. Assigned pricingRuleId
   * 2. Category-matching rule (store-scoped or global)
   * 3. Fallback rule
   */
  async resolveRuleForProduct(product: {
    productId?: number;
    category?: string;
    pricingRuleId?: number | null;
    storeId?: number;
  }): Promise<PricingRule> {
    if (product.pricingRuleId) {
      const row = await prisma.pricingRule.findUnique({
        where: { ruleId: product.pricingRuleId },
      });
      if (row) return PricingRuleRepository.toDomain(row);
    }

    if (product.category) {
      const row = await prisma.pricingRule.findFirst({
        where: {
          category: product.category,
          OR: [
            { storeId: product.storeId ?? undefined },
            { storeId: null },
          ],
        },
        orderBy: { storeId: "desc" },
      });
      if (row) return PricingRuleRepository.toDomain(row);
    }

    return new PricingRule({
      ruleId: 0,
      discountRate: 0.025,
      expiryThresholdHours: 24,
      maximumDiscount: 0.8,
      minimumPriceFloor: 1.0,
    });
  }

  /**
   * Authoritative price calculator used across Marketplace, Product Details, Cart, and Checkout.
   */
  async calculateAuthoritativePrice(
    product: Product,
    providedRule?: PricingRule,
    currentNow: Date = clock.now()
  ): Promise<{ price: number; rule: PricingRule; discountPercent: number }> {
    const rule = providedRule ?? (await this.resolveRuleForProduct(product));
    const price = this.calculatePrice(product, rule, currentNow);
    const discountPercent =
      product.originalPrice > 0
        ? Math.round(((product.originalPrice - price) / product.originalPrice) * 100)
        : 0;
    return { price, rule, discountPercent };
  }

  /**
   * Diagram method: updateExpiredProducts()
   * Scans products and transitions expired ones to EXPIRED_REMOVED (BR-4).
   */
  updateExpiredProducts(products: Product[], currentNow: Date = clock.now()): Product[] {
    const expiredList: Product[] = [];
    for (const product of products) {
      if (
        product.expiryDateTime.getTime() <= currentNow.getTime() &&
        product.status === "ACTIVE"
      ) {
        product.transitionStatus("EXPIRED_REMOVED");
        expiredList.push(product);
      }
    }
    return expiredList;
  }

  /**
   * Diagram method: applyDecayPricing()
   * Runs the recalculation loop across a collection of active products.
   */
  applyDecayPricing(
    products: Product[],
    getRuleForProduct: (p: Product) => PricingRule | undefined,
    currentNow: Date = clock.now()
  ): Map<number, number> {
    const updatedPrices = new Map<number, number>();

    for (const product of products) {
      if (product.status === "ACTIVE") {
        if (product.expiryDateTime.getTime() <= currentNow.getTime()) {
          product.transitionStatus("EXPIRED_REMOVED");
        } else {
          const rule = getRuleForProduct(product);
          const previousPrice = product.currentPrice;
          const newPrice = this.calculatePrice(product, rule, currentNow);
          if (previousPrice !== newPrice) {
            updatedPrices.set(product.productId, newPrice);
          }
        }
      }
    }

    return updatedPrices;
  }
}

