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

    const stores = await prisma.store.findMany({
      where: session.role === "ADMIN" ? {} : { ownerId: session.userId },
      orderBy: { storeId: "asc" },
    });

    if (stores.length === 0) {
      return NextResponse.json(
        { error: "No store found associated with your account" },
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

    const orders = await storeOrderService.getStoreOrders(activeStore.storeId);

    return NextResponse.json({
      success: true,
      store: {
        storeId: activeStore.storeId,
        storeName: activeStore.storeName,
        status: activeStore.status,
      },
      stores: stores.map((s) => ({
        storeId: s.storeId,
        storeName: s.storeName,
        status: s.status,
      })),
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
