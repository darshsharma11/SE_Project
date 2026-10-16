import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { PricingEngine } from "@/domain/PricingEngine";
import { ProductRepository } from "@/repositories/ProductRepository";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";

const UpdatePricingRuleSchema = z.object({
  ruleId: z.number().int().positive("Rule ID must be positive"),
  discountRate: z.number().positive().max(1.0, "Discount rate must be <= 1.0 (e.g. 0.05 for 5%/hr)"),
  expiryThresholdHours: z.number().int().positive().max(720, "Threshold hours must be positive"),
  maximumDiscount: z.number().positive().max(0.80, "Maximum discount cannot exceed 80% (0.80)"),
  minimumPriceFloor: z.number().min(1.0, "Price floor must be at least ₹1.0"),
  category: z.string().optional().nullable(),
});

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

    const rules = await prisma.pricingRule.findMany({
      include: {
        store: { select: { storeId: true, storeName: true } },
        _count: { select: { products: true } },
      },
      orderBy: { ruleId: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: rules.map((r) => ({
        ruleId: r.ruleId,
        category: r.category,
        discountRate: r.discountRate,
        expiryThresholdHours: r.expiryThresholdHours,
        maximumDiscount: r.maximumDiscount,
        minimumPriceFloor: r.minimumPriceFloor,
        storeId: r.storeId,
        storeName: r.store?.storeName ?? "Global (All Stores)",
        isGlobal: r.storeId === null,
        productCount: r._count.products,
        isActive: true,
      })),
    });
  } catch (error: any) {
    console.error("[GET /api/v1/admin/pricing-rules] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve pricing rules" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Administrator authorization required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = UpdatePricingRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      ruleId,
      discountRate,
      expiryThresholdHours,
      maximumDiscount,
      minimumPriceFloor,
      category,
    } = parsed.data;

    const existing = await prisma.pricingRule.findUnique({
      where: { ruleId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Pricing rule #${ruleId} not found` },
        { status: 404 }
      );
    }

    // Update rule in database
    const updatedRule = await prisma.pricingRule.update({
      where: { ruleId },
      data: {
        discountRate,
        expiryThresholdHours,
        maximumDiscount,
        minimumPriceFloor,
        category: category ?? existing.category,
      },
    });

    // Recalculate prices for products assigned to this rule or category
    const now = clock.now();
    const engine = new PricingEngine();
    const domainRule = PricingRuleRepository.toDomain(updatedRule);

    const affectedProducts = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { pricingRuleId: ruleId },
          { category: updatedRule.category ?? undefined, pricingRuleId: null },
        ],
      },
    });

    let recomputedCount = 0;
    for (const prodRow of affectedProducts) {
      const prodDomain = ProductRepository.toDomain(prodRow);
      const previousPrice = prodDomain.currentPrice;
      const { price: newPrice } = await engine.calculateAuthoritativePrice(
        prodDomain,
        domainRule,
        now
      );

      if (previousPrice !== newPrice) {
        await ProductRepository.updatePrice(
          prodDomain.productId,
          newPrice,
          "ADMIN_RULE_UPDATE"
        );
        recomputedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Pricing Rule #${ruleId} updated successfully. ${recomputedCount} product price(s) adjusted.`,
      rule: updatedRule,
      recomputedProductsCount: recomputedCount,
    });
  } catch (error: any) {
    console.error("[PUT /api/v1/admin/pricing-rules] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update pricing rule" },
      { status: 500 }
    );
  }
}
