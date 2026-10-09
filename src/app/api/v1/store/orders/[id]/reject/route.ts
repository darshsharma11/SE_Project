import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeOrderService } from "@/services/StoreOrderService";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "STORE_OWNER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Authentication required as STORE_OWNER" },
        { status: 401 }
      );
    }

    const orderId = parseInt(params.id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const store = await prisma.store.findFirst({
      where: { ownerId: session.userId },
    });

    if (!store && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized: store not found" }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (session.role !== "ADMIN" && order.storeId !== store?.storeId) {
      return NextResponse.json({ error: "Unauthorized: order belongs to another store" }, { status: 403 });
    }

    let reason = "Store unable to fulfill order";
    try {
      const body = await request.json();
      if (body?.reason) reason = body.reason;
    } catch {}

    const result = await storeOrderService.rejectOrder(orderId, order.storeId, reason);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/store/orders/:id/reject] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reject order" },
      { status: 400 }
    );
  }
}
