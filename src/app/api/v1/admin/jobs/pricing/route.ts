import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runPricingJob } from "@/lib/scheduler";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: ADMIN role required" },
        { status: 401 }
      );
    }

    const result = await runPricingJob();

    return NextResponse.json({
      success: true,
      message: `Decay pricing applied: ${result.updatedCount} products updated, ${result.expiredCount} expired products removed.`,
      result,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/admin/jobs/pricing] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run pricing job" },
      { status: 500 }
    );
  }
}
