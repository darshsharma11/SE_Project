import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cartService } from "@/services/CartService";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Authentication required as CUSTOMER" },
        { status: 401 }
      );
    }

    const cart = await cartService.getCart(session.userId);

    return NextResponse.json({
      success: true,
      data: cart,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/cart] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch shopping cart" },
      { status: 500 }
    );
  }
}
