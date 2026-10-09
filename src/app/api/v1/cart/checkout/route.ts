import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { checkoutService } from "@/services/CheckoutService";

const CheckoutSchema = z.object({
  paymentMethod: z.enum(["CARD", "UPI", "WALLET"]),
  cardDetails: z
    .object({
      cardNumber: z.string().optional(),
      cardholderName: z.string().optional(),
      expiry: z.string().optional(),
      cvv: z.string().optional(),
    })
    .optional(),
  upiId: z.string().optional(),
  walletName: z.string().optional(),
  confirmPriceChanges: z.boolean().optional().default(false),
  correlationId: z.string().optional(),
  simulateFailure: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Authentication required as CUSTOMER to checkout" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checkout payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await checkoutService.checkout({
      customerId: session.userId,
      paymentMethod: parsed.data.paymentMethod,
      cardDetails: parsed.data.cardDetails,
      upiId: parsed.data.upiId,
      walletName: parsed.data.walletName,
      confirmPriceChanges: parsed.data.confirmPriceChanges,
      correlationId: parsed.data.correlationId,
      simulateFailure: parsed.data.simulateFailure,
    });

    if (!result.success) {
      // Could be price changed (requires confirmation) or unavailable or payment failed
      const statusCode = result.priceChanged
        ? 409
        : result.productUnavailable || result.stockUnavailable
        ? 410
        : 402; // 402 Payment Required for payment failed

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/cart/checkout] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process checkout" },
      { status: 500 }
    );
  }
}
