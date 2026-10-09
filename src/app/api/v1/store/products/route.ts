import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { StoreRepository } from "@/repositories/StoreRepository";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";
import { PricingEngine } from "@/domain/PricingEngine";

const CreateProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  category: z.string().min(2, "Category is required"),
  originalPrice: z.number().positive("Original price must be positive"),
  expiryDateTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid expiry date string",
  }),
  quantity: z.number().int().positive("Initial quantity must be at least 1"),
  pricingRuleId: z.number().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "STORE_OWNER") {
      return NextResponse.json(
        { error: "Unauthorized: STORE_OWNER role required" },
        { status: 401 }
      );
    }

    const store = await prisma.store.findFirst({
      where: { ownerId: session.userId },
    });

    if (!store) {
      return NextResponse.json(
        { error: "No store found for current user" },
        { status: 404 }
      );
    }

    const products = await prisma.product.findMany({
      where: { storeId: store.storeId },
      include: {
        inventoryItem: true,
        pricingRule: true,
        priceHistories: {
          orderBy: { calculatedAt: "desc" },
          take: 5,
        },
      },
      orderBy: { productId: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: products,
      store: {
        storeId: store.storeId,
        storeName: store.storeName,
        status: store.status,
      },
    });
  } catch (error: any) {
    console.error("[GET /api/v1/store/products] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch store products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "STORE_OWNER") {
      return NextResponse.json(
        { error: "Unauthorized: STORE_OWNER role required" },
        { status: 401 }
      );
    }

    const storeRow = await prisma.store.findFirst({
      where: { ownerId: session.userId },
    });

    if (!storeRow) {
      return NextResponse.json(
        { error: "No store registered for current user" },
        { status: 404 }
      );
    }

    const storeDomain = StoreRepository.toDomain(storeRow);

    // Enforce Store must be VERIFIED (BR-1)
    if (storeDomain.status !== "VERIFIED") {
      return NextResponse.json(
        { error: "Store must be VERIFIED to add products" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, category, originalPrice, expiryDateTime, quantity, pricingRuleId } =
      parsed.data;
    const expiryDate = new Date(expiryDateTime);
    const now = clock.now();

    // Enforce creation rejects expiry <= now (BR-4)
    if (expiryDate.getTime() <= now.getTime()) {
      return NextResponse.json(
        { error: "Product creation rejected: expiry date must be in the future" },
        { status: 400 }
      );
    }

    // Call store domain method
    const productDomain = storeDomain.addProduct({
      name,
      category,
      originalPrice,
      expiryDateTime: expiryDate,
      pricingRuleId: pricingRuleId ?? undefined,
      now,
    });

    // Determine initial pricing rule
    let ruleDomain = undefined;
    if (pricingRuleId) {
      const ruleRow = await PricingRuleRepository.findById(pricingRuleId);
      if (ruleRow) ruleDomain = ruleRow;
    }

    // Calculate initial dynamic price
    const engine = new PricingEngine();
    const calculatedPrice = engine.calculatePrice(
      productDomain,
      ruleDomain,
      now
    );

    // Persist atomically in transaction
    const newProduct = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          category,
          originalPrice,
          currentPrice: calculatedPrice,
          expiryDateTime: expiryDate,
          status: "ACTIVE",
          storeId: storeRow.storeId,
          pricingRuleId: pricingRuleId ?? null,
        },
      });

      await tx.inventoryItem.create({
        data: {
          productId: created.productId,
          quantity,
          reservedQuantity: 0,
        },
      });

      await tx.priceHistory.create({
        data: {
          productId: created.productId,
          price: calculatedPrice,
          reason: "CREATION",
        },
      });

      return tx.product.findUnique({
        where: { productId: created.productId },
        include: {
          inventoryItem: true,
          pricingRule: true,
          priceHistories: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: newProduct,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/store/products] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create product" },
      { status: 500 }
    );
  }
}
