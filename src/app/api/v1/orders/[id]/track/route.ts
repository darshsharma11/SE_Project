import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deliveryService } from "@/services/DeliveryService";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const orderId = parseInt(params.id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const order = await deliveryService.getTrackingInfo(orderId);

    // Authorization checks for all roles
    if (session.role === "CUSTOMER" && order.customerId !== session.userId) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this order" },
        { status: 403 }
      );
    }

    if (session.role === "STORE_OWNER") {
      const store = await prisma.store.findUnique({
        where: { storeId: order.storeId },
        select: { ownerId: true },
      });
      if (store?.ownerId !== session.userId) {
        return NextResponse.json(
          { error: "Forbidden: You do not own the store for this order" },
          { status: 403 }
        );
      }
    }

    if (session.role === "DELIVERY_PARTNER") {
      if (order.delivery?.partnerId !== session.userId) {
        return NextResponse.json(
          { error: "Forbidden: This delivery is not assigned to you" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error: any) {
    console.error("[GET /api/v1/orders/:id/track] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch tracking info" },
      { status: 500 }
    );
  }
}
