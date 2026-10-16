import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { clock } from "@/lib/clock";
import { runPricingJob } from "@/lib/scheduler";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Administrator authorization required" },
        { status: 403 }
      );
    }

    // Reset clock offset to 0
    clock.reset();

    // Re-evaluate pricing at real current time
    const jobResult = await runPricingJob();

    return NextResponse.json({
      success: true,
      message: "Demo clock has been safely reset to actual real-world time.",
      simulatedNow: clock.now().toISOString(),
      offsetMs: 0,
      updatedProducts: jobResult.updatedProducts,
      expiredProducts: jobResult.expiredProducts,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/admin/demo/reset-time] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset demo clock" },
      { status: 500 }
    );
  }
}
