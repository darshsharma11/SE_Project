import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { storeOrderService } from "@/services/StoreOrderService";

const SweepSchema = z.object({
  timeoutMinutes: z
    .number({ invalid_type_error: "timeoutMinutes must be a number" })
    .int("timeoutMinutes must be an integer")
    .min(1, "timeoutMinutes must be at least 1 minute")
    .max(1440, "timeoutMinutes cannot exceed 24 hours (1440 minutes)")
    .optional()
    .default(15),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "STORE_OWNER")) {
      return NextResponse.json(
        { error: "Unauthorized: ADMIN or STORE_OWNER authorization required" },
        { status: 403 }
      );
    }

    let timeoutMinutes = 15;
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        const body = JSON.parse(text);
        const parsed = SweepSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Validation error", details: parsed.error.format() },
            { status: 400 }
          );
        }
        timeoutMinutes = parsed.data.timeoutMinutes;
      }
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const result = await storeOrderService.sweepUnrespondedOrders(timeoutMinutes);

    return NextResponse.json({
      success: true,
      message: `Sweeper completed successfully. ${result.sweptCount} unresponded order(s) cancelled and refunded.`,
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
