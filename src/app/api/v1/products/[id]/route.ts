import { NextRequest, NextResponse } from "next/server";
import { marketplaceService } from "@/services/MarketplaceService";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = Number(params.id);
    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "Invalid product ID parameter" },
        { status: 400 }
      );
    }

    const data = await marketplaceService.getProductById(productId);
    if (!data) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.product,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/products/:id] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve product details" },
      { status: 500 }
    );
  }
}
