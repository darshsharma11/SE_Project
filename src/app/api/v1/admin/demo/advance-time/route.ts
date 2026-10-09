import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { clock } from "@/lib/clock";
import { runPricingJob } from "@/lib/scheduler";

const AdvanceTimeSchema = z.object({
  hours: z.number().int().min(1, "Must advance by at least 1 hour").max(720, "Maximum 720 hours (30 days)"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    // Allow ADMIN or demo usage
    if (session && session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: ADMIN role required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = AdvanceTimeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { hours } = parsed.data;

    // Advance clock
    clock.advanceHours(hours);

    // Run pricing job over active products
    const jobResult = await runPricingJob();

    return NextResponse.json({
      success: true,
      message: `Clock advanced by ${hours} hours. Dynamic decay evaluated.`,
      hoursAdvanced: hours,
      simulatedNow: clock.now().toISOString(),
      offsetMs: clock.getOffsetMs(),
      updatedProducts: jobResult.updatedProducts,
      expiredProducts: jobResult.expiredProducts,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/admin/demo/advance-time] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to advance clock" },
      { status: 500 }
    );
  }
}
