import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { cartService } from "@/services/CartService";

const AddItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
  correlationId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Authentication required as CUSTOMER to add items to cart" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = AddItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid item payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { productId, quantity, correlationId } = parsed.data;

    const result = await cartService.addItem(
      session.userId,
      productId,
      quantity,
      correlationId
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/cart/items] Error:", error);
    const isStockError = error.message?.includes("stockUnavailable");
    return NextResponse.json(
      { error: error.message || "Failed to add item to cart" },
      { status: isStockError ? 409 : 500 }
    );
  }
}
