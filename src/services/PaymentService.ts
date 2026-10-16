import { trace } from "@/lib/trace";
import { prisma } from "@/lib/prisma";

export interface CardDetails {
  cardNumber?: string;
  cardholderName?: string;
  expiry?: string;
  cvv?: string;
}

export interface ProcessPaymentParams {
  amount: number;
  method: "CARD" | "UPI" | "WALLET";
  cardDetails?: CardDetails;
  upiId?: string;
  walletName?: string;
  orderId?: number;
  orderIds?: number[];
  correlationId?: string;
  simulateFailure?: boolean;
}

export interface PaymentGatewayResult {
  success: boolean;
  transactionId: string;
  status: "SUCCESSFUL" | "FAILED";
  failureReason?: string;
}

export interface ProcessRefundParams {
  paymentId: number;
  amount: number;
  correlationId?: string;
  reason?: string;
  simulateFailure?: boolean;
}

export interface RefundGatewayResult {
  success: boolean;
  refundTransactionId: string;
  status: "REFUNDED" | "FAILED";
  error?: string;
}

export class PaymentService {
  /**
   * Sequence Step 25 & 26: processPayment & authorizePayment
   * Failure Step 41 & 42: paymentFailed
   * Success Step 27 & 28: paymentSuccessful & paymentConfirmed
   */
  async processPayment(params: ProcessPaymentParams): Promise<PaymentGatewayResult> {
    const { amount, method, cardDetails, upiId, correlationId } = params;

    // Step 25: Order -> Payment processPayment(amount)
    if (correlationId) {
      await trace.step({
        correlationId,
        stepNumber: 25,
        label: "processPayment(amount)",
        from: "Order",
        to: "Payment",
        details: { amount, method, orderIds: params.orderIds ?? (params.orderId ? [params.orderId] : []) },
      });
    }

    // Step 26: Payment -> PaymentGateway authorizePayment(amount)
    if (correlationId) {
      await trace.step({
        correlationId,
        stepNumber: 26,
        label: "authorizePayment(amount)",
        from: "Payment",
        to: "PaymentGateway",
        details: { amount, method },
      });
    }

    // Determine simulation failure rule:
    // Card ends in 0000 or cardholder contains 'FAIL' or upiId contains 'fail' or explicitly flagged
    const rawCard = (cardDetails?.cardNumber || "").replace(/\s+/g, "");
    const cardholder = (cardDetails?.cardholderName || "").toUpperCase();
    const upi = (upiId || "").toLowerCase();

    const isFailure =
      params.simulateFailure === true ||
      rawCard.endsWith("0000") ||
      cardholder.includes("FAIL") ||
      upi.includes("fail");

    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    if (isFailure) {
      // Step 41: PaymentGateway -> Payment paymentFailed
      if (correlationId) {
        await trace.step({
          correlationId,
          stepNumber: 41,
          label: "paymentFailed",
          from: "PaymentGateway",
          to: "Payment",
          details: { reason: "Simulated payment failure (card ended in 0000 or FAIL flag)" },
        });
      }

      // Step 42: Payment -> Order paymentFailed
      if (correlationId) {
        await trace.step({
          correlationId,
          stepNumber: 42,
          label: "paymentFailed",
          from: "Payment",
          to: "Order",
          details: { transactionId },
        });
      }

      return {
        success: false,
        transactionId,
        status: "FAILED",
        failureReason: "Payment authorization declined by simulated gateway (card 0000 / FAIL trigger)",
      };
    }

    // Success path
    // Step 27: PaymentGateway -> Payment paymentSuccessful
    if (correlationId) {
      await trace.step({
        correlationId,
        stepNumber: 27,
        label: "paymentSuccessful",
        from: "PaymentGateway",
        to: "Payment",
        details: { transactionId, amount },
      });
    }

    // Step 28: Payment -> Order paymentConfirmed
    if (correlationId) {
      await trace.step({
        correlationId,
        stepNumber: 28,
        label: "paymentConfirmed",
        from: "Payment",
        to: "Order",
        details: { transactionId },
      });
    }

    return {
      success: true,
      transactionId,
      status: "SUCCESSFUL",
    };
  }

  /**
   * Sequence & SRS requirement: processRefund
   * Gateway contract: verifies payment exists and is in SUCCESSFUL status.
   * Fails if simulateFailure is true, amount <= 0, or payment not in SUCCESSFUL state.
   */
  async processRefund(params: ProcessRefundParams): Promise<RefundGatewayResult> {
    const payment = await prisma.payment.findUnique({
      where: { paymentId: params.paymentId },
    });

    if (!payment) {
      return {
        success: false,
        refundTransactionId: "",
        status: "FAILED",
        error: `Payment record with ID ${params.paymentId} not found`,
      };
    }

    if (payment.status !== "SUCCESSFUL") {
      return {
        success: false,
        refundTransactionId: "",
        status: "FAILED",
        error: `Gateway contract violation: Cannot refund payment with status '${payment.status}'. Only SUCCESSFUL payments are eligible for refund.`,
      };
    }

    if (params.simulateFailure || params.amount <= 0) {
      return {
        success: false,
        refundTransactionId: "",
        status: "FAILED",
        error: "Simulated refund failure: gateway declined refund request",
      };
    }

    const refundTransactionId = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Update status in database
    await prisma.payment.update({
      where: { paymentId: params.paymentId },
      data: { status: "REFUNDED" },
    });

    if (params.correlationId) {
      await trace.step({
        correlationId: params.correlationId,
        stepNumber: 42,
        label: "paymentRefunded",
        from: "PaymentGateway",
        to: "Payment",
        details: { refundTransactionId, amount: params.amount, reason: params.reason },
      });
    }

    return {
      success: true,
      refundTransactionId,
      status: "REFUNDED",
    };
  }
}

export const paymentService = new PaymentService();
