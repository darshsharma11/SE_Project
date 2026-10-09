import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { cartService } from "@/services/CartService";

const UpdateQuantitySchema = z.object({
  quantity: z.number().int().min(0),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Authentication required as CUSTOMER" },
        { status: 401 }
      );
    }

    const cartItemId = parseInt(params.id, 10);
    if (isNaN(cartItemId)) {
      return NextResponse.json({ error: "Invalid cart item ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = UpdateQuantitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid quantity", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await cartService.updateQuantity(
      session.userId,
      cartItemId,
      parsed.data.quantity
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[PUT /api/v1/cart/items/[id]] Error:", error);
    const isStockError = error.message?.includes("stockUnavailable");
    return NextResponse.json(
      { error: error.message || "Failed to update item quantity" },
      { status: isStockError ? 409 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Authentication required as CUSTOMER" },
        { status: 401 }
      );
    }

    const cartItemId = parseInt(params.id, 10);
    if (isNaN(cartItemId)) {
      return NextResponse.json({ error: "Invalid cart item ID" }, { status: 400 });
    }

    const result = await cartService.removeItem(session.userId, cartItemId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[DELETE /api/v1/cart/items/[id]] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove cart item" },
      { status: 500 }
    );
  }
}
