import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductRepository } from "@/repositories/ProductRepository";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "STORE_OWNER") {
      return NextResponse.json(
        { error: "Unauthorized: STORE_OWNER role required" },
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
      include: { store: true },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    if (existingProduct.store.ownerId !== session.userId) {
      return NextResponse.json(
        { error: "Forbidden: You do not own the store for this product" },
        { status: 403 }
      );
    }

    const domainProduct = ProductRepository.toDomain(existingProduct);
    // Transition status guard: ACTIVE -> MANUALLY_REMOVED
    domainProduct.transitionStatus("MANUALLY_REMOVED");

    await prisma.product.update({
      where: { productId },
      data: { status: "MANUALLY_REMOVED" },
    });

    return NextResponse.json({
      success: true,
      message: "Product deactivated successfully",
      status: "MANUALLY_REMOVED",
    });
  } catch (error: any) {
    console.error("[POST /api/v1/store/products/:id/deactivate] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to deactivate product" },
      { status: 500 }
    );
  }
}
