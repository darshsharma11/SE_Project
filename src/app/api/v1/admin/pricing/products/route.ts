import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { getExpiryBand } from "@/lib/config";
import { PricingEngine } from "@/domain/PricingEngine";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Administrator authorization required" },
        { status: 403 }
      );
    }

    const now = clock.now();
    const engine = new PricingEngine();

    const products = await prisma.product.findMany({
      include: {
        store: { select: { storeId: true, storeName: true, status: true, address: true } },
        pricingRule: true,
        inventoryItem: true,
        priceHistories: {
          orderBy: { calculatedAt: "desc" },
          take: 10,
        },
      },
      orderBy: [{ storeId: "asc" }, { productId: "asc" }],
    });

    const enrichedProducts = await Promise.all(
      products.map(async (p) => {
        const diffMs = p.expiryDateTime.getTime() - now.getTime();
        const hoursRemaining = Math.max(0, Number((diffMs / (3600 * 1000)).toFixed(2)));
        const isExpired = p.expiryDateTime.getTime() <= now.getTime();
        const band = isExpired ? "EXPIRED" : getExpiryBand(p.expiryDateTime, now);

        // Resolve rule
        const ruleDomain = p.pricingRule
          ? PricingRuleRepository.toDomain(p.pricingRule)
          : await engine.resolveRuleForProduct({
              productId: p.productId,
              category: p.category,
              pricingRuleId: p.pricingRuleId,
              storeId: p.storeId,
            });

        // Exact engine calculation steps
        const threshold = ruleDomain.expiryThresholdHours;
        const inDecayWindow = !isExpired && hoursRemaining <= threshold;
        const elapsed = inDecayWindow ? Math.max(0, threshold - hoursRemaining) : 0;
        const computedDiscountFraction = inDecayWindow
          ? ruleDomain.discountRate * elapsed
          : isExpired
          ? ruleDomain.maximumDiscount
          : 0;

        const appliedDiscountFraction = Math.min(
          computedDiscountFraction,
          ruleDomain.maximumDiscount,
          0.80
        );

        const rawDiscountedPrice = p.originalPrice * (1 - appliedDiscountFraction);
        const flooredPrice = Math.max(rawDiscountedPrice, ruleDomain.minimumPriceFloor);
        // Never increase price above originalPrice due to floor rule
        const effectivePrice = Math.min(p.originalPrice, flooredPrice);
        const finalCalculatedPrice = Math.round(effectivePrice);

        const discountPercent =
          p.originalPrice > 0
            ? Math.round(((p.originalPrice - p.currentPrice) / p.originalPrice) * 100)
            : 0;

        return {
          productId: p.productId,
          name: p.name,
          category: p.category,
          status: p.status,
          originalPrice: p.originalPrice,
          currentPrice: p.currentPrice,
          finalCalculatedPrice,
          discountPercent,
          expiryDateTime: p.expiryDateTime.toISOString(),
          hoursRemaining,
          band,
          isExpired,
          store: p.store,
          inventory: p.inventoryItem
            ? {
                quantity: p.inventoryItem.quantity,
                reservedQuantity: p.inventoryItem.reservedQuantity,
                available: Math.max(0, p.inventoryItem.quantity - p.inventoryItem.reservedQuantity),
              }
            : null,
          pricingRule: {
            ruleId: ruleDomain.ruleId,
            category: ruleDomain.category ?? p.category,
            discountRate: ruleDomain.discountRate,
            expiryThresholdHours: ruleDomain.expiryThresholdHours,
            maximumDiscount: ruleDomain.maximumDiscount,
            minimumPriceFloor: ruleDomain.minimumPriceFloor,
            storeId: ruleDomain.storeId ?? null,
            isGlobal: !ruleDomain.storeId,
          },
          lastPriceUpdate: p.priceHistories[0]?.calculatedAt.toISOString() ?? null,
          priceHistories: p.priceHistories.map((h) => ({
            historyId: h.historyId,
            price: h.price,
            calculatedAt: h.calculatedAt.toISOString(),
            reason: h.reason,
          })),
          calculationExplanation: {
            originalPrice: p.originalPrice,
            hoursRemaining,
            expiryThresholdHours: threshold,
            inDecayWindow,
            hoursElapsedInWindow: Number(elapsed.toFixed(2)),
            discountRatePerHour: ruleDomain.discountRate,
            computedDiscountPercent: Number((computedDiscountFraction * 100).toFixed(1)),
            maximumDiscountCapPercent: Number((ruleDomain.maximumDiscount * 100).toFixed(1)),
            appliedDiscountPercent: Number((appliedDiscountFraction * 100).toFixed(1)),
            rawDiscountedPrice: Number(rawDiscountedPrice.toFixed(2)),
            minimumPriceFloor: ruleDomain.minimumPriceFloor,
            flooredPrice: Number(flooredPrice.toFixed(2)),
            effectivePrice: Number(effectivePrice.toFixed(2)),
            finalSellingPrice: finalCalculatedPrice,
            isFloorActive: rawDiscountedPrice < ruleDomain.minimumPriceFloor,
            isCapActive: computedDiscountFraction >= ruleDomain.maximumDiscount,
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      clockNow: now.toISOString(),
      products: enrichedProducts,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/admin/pricing/products] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve product pricing data" },
      { status: 500 }
    );
  }
}
