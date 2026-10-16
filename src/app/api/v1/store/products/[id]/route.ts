import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { ProductRepository } from "@/repositories/ProductRepository";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";
import { PricingEngine } from "@/domain/PricingEngine";

const UpdateProductSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().min(2).optional(),
  originalPrice: z.number().positive().optional(),
  expiryDateTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" })
    .optional(),
  quantity: z.number().int().min(0).optional(),
  pricingRuleId: z.number().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "STORE_OWNER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized: STORE_OWNER or ADMIN role required" },
        { status: 401 }
      );
    }

    const productId = Number(params.id);
    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "Invalid product ID parameter" },
        { status: 400 }
      );
    }

    const existingProduct = await prisma.product.findUnique({
      where: { productId },
      include: {
        store: true,
        inventoryItem: true,
        pricingRule: true,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Check store ownership
    if (existingProduct.store.ownerId !== session.userId) {
      return NextResponse.json(
        { error: "Forbidden: You do not own the store for this product" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, category, originalPrice, expiryDateTime, quantity, pricingRuleId } =
      parsed.data;
    const now = clock.now();

    const newExpiryDate = expiryDateTime
      ? new Date(expiryDateTime)
      : existingProduct.expiryDateTime;

    if (expiryDateTime && newExpiryDate.getTime() <= now.getTime()) {
      return NextResponse.json(
        { error: "Product expiry date must be in the future" },
        { status: 400 }
      );
    }

    const productDomain = ProductRepository.toDomain({
      ...existingProduct,
      name: name ?? existingProduct.name,
      category: category ?? existingProduct.category,
      originalPrice: originalPrice ?? existingProduct.originalPrice,
      expiryDateTime: newExpiryDate,
      pricingRuleId:
        pricingRuleId !== undefined
          ? pricingRuleId
          : existingProduct.pricingRuleId,
    });

    // Determine and validate pricing rule
    const ruleIdToUse =
      pricingRuleId !== undefined
        ? pricingRuleId
        : existingProduct.pricingRuleId;

    let ruleDomain = undefined;
    if (ruleIdToUse) {
      const found = await PricingRuleRepository.findById(ruleIdToUse);
      if (!found) {
        return NextResponse.json(
          { error: `Pricing rule ID ${ruleIdToUse} not found` },
          { status: 400 }
        );
      }
      if (
        found.storeId !== undefined &&
        found.storeId !== existingProduct.storeId &&
        session.role !== "ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Cannot assign a private pricing rule from another store" },
          { status: 403 }
        );
      }
      const effectiveCategory = category ?? existingProduct.category;
      if (
        found.category &&
        found.category.toLowerCase() !== effectiveCategory.toLowerCase()
      ) {
        return NextResponse.json(
          {
            error: `Pricing rule category "${found.category}" is incompatible with product category "${effectiveCategory}"`,
          },
          { status: 400 }
        );
      }
      ruleDomain = found;
    }

    // Immediately recalculate authoritative price
    const engine = new PricingEngine();
    const previousPrice = existingProduct.currentPrice;
    const { price: recalculatedPrice } = await engine.calculateAuthoritativePrice(
      productDomain,
      ruleDomain,
      now
    );

    // Update in database with transaction
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { productId },
        data: {
          name: name ?? undefined,
          category: category ?? undefined,
          originalPrice: originalPrice ?? undefined,
          currentPrice: recalculatedPrice,
          expiryDateTime: expiryDateTime ? newExpiryDate : undefined,
          pricingRuleId:
            pricingRuleId !== undefined ? pricingRuleId : undefined,
        },
      });

      if (quantity !== undefined && existingProduct.inventoryItem) {
        if (quantity < existingProduct.inventoryItem.reservedQuantity) {
          throw new Error("Quantity cannot be less than reserved quantity");
        }
        await tx.inventoryItem.update({
          where: { inventoryId: existingProduct.inventoryItem.inventoryId },
          data: { quantity },
        });
      }

      if (previousPrice !== recalculatedPrice) {
        await tx.priceHistory.create({
          data: {
            productId,
            price: recalculatedPrice,
            reason: "MANUAL_EDIT",
          },
        });
      }

      return tx.product.findUnique({
        where: { productId },
        include: {
          inventoryItem: true,
          pricingRule: true,
          priceHistories: { orderBy: { calculatedAt: "desc" }, take: 10 },
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error("[PATCH /api/v1/store/products/:id] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update product" },
      { status: 500 }
    );
  }
}
