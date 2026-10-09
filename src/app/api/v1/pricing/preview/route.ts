import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PricingRule } from "@/domain/PricingRule";
import { getExpiryBand } from "@/lib/config";
import { clock } from "@/lib/clock";

const PreviewSchema = z.object({
  originalPrice: z.number().positive(),
  discountRate: z.number().positive().max(1.0),
  expiryThresholdHours: z.number().int().positive(),
  maximumDiscount: z.number().positive().max(0.80),
  minimumPriceFloor: z.number().min(1.0).default(1.0),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PreviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid preview parameters", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      originalPrice,
      discountRate,
      expiryThresholdHours,
      maximumDiscount,
      minimumPriceFloor,
    } = parsed.data;

    const rule = new PricingRule({
      ruleId: 0,
      discountRate,
      expiryThresholdHours,
      maximumDiscount,
      minimumPriceFloor,
    });

    const sampleHours = [72, 48, 24, 18, 12, 6, 4, 2, 1, 0];
    const now = clock.now();

    const curve = sampleHours.map((hours) => {
      const simulatedExpiry = new Date(now.getTime() + hours * 3600 * 1000);
      const discountFraction = rule.calculateDiscount(simulatedExpiry, now);

      const computedPrice = Math.max(
        originalPrice * (1 - discountFraction),
        rule.minimumPriceFloor
      );
      const roundedPrice = Math.round(computedPrice);
      const effectiveDiscountPercent =
        originalPrice > 0
          ? Math.round(((originalPrice - roundedPrice) / originalPrice) * 100)
          : 0;

      const band = getExpiryBand(simulatedExpiry, now);

      return {
        hoursRemaining: hours,
        discountFraction: Number(discountFraction.toFixed(4)),
        discountPercent: effectiveDiscountPercent,
        price: roundedPrice,
        isFloored: roundedPrice <= rule.minimumPriceFloor,
        isCapped: discountFraction >= rule.maximumDiscount || discountFraction >= 0.80,
        band,
      };
    });

    return NextResponse.json({
      success: true,
      originalPrice,
      rule: {
        discountRate,
        expiryThresholdHours,
        maximumDiscount,
        minimumPriceFloor,
      },
      preview: curve,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/pricing/preview] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate price preview" },
      { status: 500 }
    );
  }
}
