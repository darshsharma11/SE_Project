import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { PricingEngine } from "@/domain/PricingEngine";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";
import { ProductRepository } from "@/repositories/ProductRepository";

const PricingRuleSchema = z.object({
  ruleId: z.number().optional(),
  discountRate: z.number().positive().max(1.0, "Discount rate must be <= 1.0 (e.g. 0.05 for 5%/hr)"),
  expiryThresholdHours: z.number().int().positive().max(720, "Threshold hours must be positive"),
  maximumDiscount: z.number().positive().max(0.80, "Maximum discount cannot exceed 80% (0.80)"),
  minimumPriceFloor: z.number().min(1.0, "Price floor must be at least ₹1.0"),
  category: z.string().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "STORE_OWNER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized: STORE_OWNER or ADMIN required" },
        { status: 401 }
      );
    }

    const stores = await prisma.store.findMany({
      where: session.role === "ADMIN" ? {} : { ownerId: session.userId },
      orderBy: { storeId: "asc" },
    });

    const requestedStoreId = request.nextUrl.searchParams.get("storeId");
    let activeStore = stores[0];

    if (requestedStoreId && stores.length > 0) {
      const parsedId = parseInt(requestedStoreId, 10);
      const matched = stores.find((s) => s.storeId === parsedId);
      if (matched) activeStore = matched;
    }

    const rules = await prisma.pricingRule.findMany({
      where: {
        OR: [
          { storeId: activeStore?.storeId ?? undefined },
          { storeId: null },
        ],
      },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { ruleId: "asc" },
    });

    return NextResponse.json({
      success: true,
      store: activeStore ? { storeId: activeStore.storeId, storeName: activeStore.storeName } : null,
      stores: stores.map((s) => ({ storeId: s.storeId, storeName: s.storeName, status: s.status })),
      data: rules,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/store/pricing-rules] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve pricing rules" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "STORE_OWNER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized: STORE_OWNER or ADMIN required" },
        { status: 401 }
      );
    }

    const store = await prisma.store.findFirst({
      where: { ownerId: session.userId },
    });

    if (!store) {
      return NextResponse.json(
        { error: "No store found for user" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = PricingRuleSchema.safeParse(body);
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

    const now = clock.now();
    const engine = new PricingEngine();

    // Upsert pricing rule with strict ownership verification
    if (ruleId) {
      const existingRule = await prisma.pricingRule.findUnique({
        where: { ruleId },
      });
      if (!existingRule) {
        return NextResponse.json(
          { error: "Pricing rule not found" },
          { status: 404 }
        );
      }
      // Store owners cannot edit another store's private rules
      if (
        existingRule.storeId !== null &&
        existingRule.storeId !== store.storeId &&
        session.role !== "ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to modify another store's pricing rule" },
          { status: 403 }
        );
      }
      // Store owners cannot overwrite global rules (storeId === null)
      if (existingRule.storeId === null && session.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Global platform rules can only be edited by an Administrator" },
          { status: 403 }
        );
      }
    }

    const savedRule = ruleId
      ? await prisma.pricingRule.update({
          where: { ruleId },
          data: {
            discountRate,
            expiryThresholdHours,
            maximumDiscount,
            minimumPriceFloor,
            category: category ?? undefined,
          },
        })
      : await prisma.pricingRule.create({
          data: {
            discountRate,
            expiryThresholdHours,
            maximumDiscount,
            minimumPriceFloor,
            category: category ?? undefined,
            storeId: store.storeId,
          },
        });

    const ruleDomain = PricingRuleRepository.toDomain(savedRule);

    // "Editing price, quantity or rule recalculates that product immediately."
    // Find all ACTIVE products linked to this rule
    const productsLinked = await prisma.product.findMany({
      where: {
        pricingRuleId: savedRule.ruleId,
        status: "ACTIVE",
      },
    });

    let recalculatedCount = 0;
    for (const prodRow of productsLinked) {
      const prodDomain = ProductRepository.toDomain(prodRow);
      const prevPrice = prodRow.currentPrice;
      const newPrice = engine.calculatePrice(prodDomain, ruleDomain, now);

      if (prevPrice !== newPrice) {
        await ProductRepository.updatePrice(
          prodRow.productId,
          newPrice,
          "RULE_UPDATE"
        );
        recalculatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: savedRule,
      recalculatedProductsCount: recalculatedCount,
    });
  } catch (error: any) {
    console.error("[PUT /api/v1/store/pricing-rules] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save pricing rule" },
      { status: 500 }
    );
  }
}
