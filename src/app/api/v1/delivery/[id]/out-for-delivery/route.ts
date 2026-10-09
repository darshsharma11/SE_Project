import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deliveryService } from "@/services/DeliveryService";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "DELIVERY_PARTNER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Authentication required as DELIVERY_PARTNER" },
        { status: 401 }
      );
    }

    const deliveryId = parseInt(params.id, 10);
    if (isNaN(deliveryId)) {
      return NextResponse.json({ error: "Invalid delivery ID" }, { status: 400 });
    }

    // Steps 35-37: set OUT_FOR_DELIVERY + notify customer
    const result = await deliveryService.setOutForDelivery(deliveryId, session.userId);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[POST /api/v1/delivery/:id/out-for-delivery] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark out for delivery" },
      { status: 400 }
    );
  }
}
