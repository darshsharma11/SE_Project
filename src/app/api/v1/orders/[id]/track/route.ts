import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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

    // Authorization: customers can only see their own, store owners can see their store's
    if (session.role === "CUSTOMER" && order.customerId !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
