import { NextRequest, NextResponse } from "next/server";
import { storeOrderService } from "@/services/StoreOrderService";

export async function POST(request: NextRequest) {
  try {
    let timeoutMinutes = 15;
    try {
      const body = await request.json();
      if (body?.timeoutMinutes) timeoutMinutes = Number(body.timeoutMinutes);
    } catch {}

    const result = await storeOrderService.sweepUnrespondedOrders(timeoutMinutes);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/store/orders/sweep] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute store order sweeper" },
      { status: 500 }
    );
  }
}
