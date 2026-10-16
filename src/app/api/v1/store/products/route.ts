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
  storeId: z.number().int().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "STORE_OWNER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized: STORE_OWNER or ADMIN role required" },
        { status: 401 }
      );
    }

    // Find all stores owned by this user (or all stores if ADMIN)
    const stores = await prisma.store.findMany({
      where: session.role === "ADMIN" ? {} : { ownerId: session.userId },
      orderBy: { storeId: "asc" },
    });

    if (stores.length === 0) {
      return NextResponse.json(
        { error: "No store found for current user" },
        { status: 404 }
      );
    }

    const requestedStoreId = request.nextUrl.searchParams.get("storeId");
    let activeStore = stores[0];

    if (requestedStoreId) {
      const parsedId = parseInt(requestedStoreId, 10);
      const matched = stores.find((s) => s.storeId === parsedId);
      if (!matched && session.role !== "ADMIN") {
        return NextResponse.json(
          { error: `Forbidden: You do not own store #${parsedId}` },
          { status: 403 }
        );
      }
      if (matched) {
        activeStore = matched;
      }
    }

    const products = await prisma.product.findMany({
      where: { storeId: activeStore.storeId },
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

    const now = clock.now();
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

    // Compute store analytics for this active store
    const storeOrders = await prisma.order.findMany({
      where: { storeId: activeStore.storeId },
      select: { totalAmount: true, status: true },
    });

    const totalProducts = products.filter((p) => p.status === "ACTIVE").length;
    const totalInventory = products.reduce((sum, p) => {
      if (p.inventoryItem && p.status === "ACTIVE") {
        return sum + Math.max(0, p.inventoryItem.quantity - p.inventoryItem.reservedQuantity);
      }
      return sum;
    }, 0);
    const nearExpiryCount = products.filter(
      (p) => p.status === "ACTIVE" && p.expiryDateTime <= in24h && p.expiryDateTime > now
    ).length;
    const totalOrders = storeOrders.length;
    const pendingOrders = storeOrders.filter(
      (o) => o.status === "PLACED" || o.status === "CONFIRMED"
    ).length;
    const storeRevenue = storeOrders
      .filter((o) => ["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status))
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return NextResponse.json({
      success: true,
      data: products,
      store: {
        storeId: activeStore.storeId,
        storeName: activeStore.storeName,
        status: activeStore.status,
        address: activeStore.address,
      },
      stores: stores.map((s) => ({
        storeId: s.storeId,
        storeName: s.storeName,
        status: s.status,
      })),
      analytics: {
        totalProducts,
        totalInventory,
        nearExpiryCount,
        totalOrders,
        pendingOrders,
        storeRevenue,
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
    if (!session || (session.role !== "STORE_OWNER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized: STORE_OWNER or ADMIN role required" },
        { status: 401 }
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

    const { name, category, originalPrice, expiryDateTime, quantity, pricingRuleId, storeId } =
      parsed.data;

    let storeRow: any = null;
    if (storeId) {
      storeRow = await prisma.store.findUnique({
        where: { storeId },
      });
      if (!storeRow || (storeRow.ownerId !== session.userId && session.role !== "ADMIN")) {
        return NextResponse.json(
          { error: "Forbidden: You do not own this store" },
          { status: 403 }
        );
      }
    } else {
      storeRow = await prisma.store.findFirst({
        where: { ownerId: session.userId },
      });
    }

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

    // Determine and validate initial pricing rule
    let ruleDomain = undefined;
    if (pricingRuleId) {
      const ruleRow = await PricingRuleRepository.findById(pricingRuleId);
      if (!ruleRow) {
        return NextResponse.json(
          { error: `Pricing rule ID ${pricingRuleId} not found` },
          { status: 400 }
        );
      }
      if (
        ruleRow.storeId !== undefined &&
        ruleRow.storeId !== storeRow.storeId &&
        session.role !== "ADMIN"
      ) {
        return NextResponse.json(
          { error: "Forbidden: Cannot assign a private pricing rule from another store" },
          { status: 403 }
        );
      }
      if (
        ruleRow.category &&
        ruleRow.category.toLowerCase() !== category.toLowerCase()
      ) {
        return NextResponse.json(
          {
            error: `Pricing rule category "${ruleRow.category}" is incompatible with product category "${category}"`,
          },
          { status: 400 }
        );
      }
      ruleDomain = ruleRow;
    }

    // Calculate initial dynamic price
    const engine = new PricingEngine();
    const { price: calculatedPrice } = await engine.calculateAuthoritativePrice(
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
