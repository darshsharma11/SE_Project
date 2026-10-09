import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeOrderService } from "@/services/StoreOrderService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "STORE_OWNER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Authentication required as STORE_OWNER" },
        { status: 401 }
      );
    }

    // Find the store owned by this user
    const store = await prisma.store.findFirst({
      where: { ownerId: session.userId },
    });

    if (!store && session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No store found associated with your account" },
        { status: 404 }
      );
    }

    const storeId = store ? store.storeId : parseInt(request.nextUrl.searchParams.get("storeId") || "0", 10);
    const orders = await storeOrderService.getStoreOrders(storeId);

    return NextResponse.json({
      success: true,
      store: store ? { storeId: store.storeId, storeName: store.storeName } : null,
      data: orders,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/store/orders] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch store orders" },
      { status: 500 }
    );
  }
}
