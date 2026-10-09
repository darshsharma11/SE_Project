import { clock } from "@/lib/clock";

export type PaymentStatus = "PENDING" | "SUCCESSFUL" | "FAILED" | "REFUNDED";

export class Payment {
  paymentId: number;
  amount: number;
  paymentDate: Date;
  method: string;
  status: PaymentStatus;
  orderId?: number;          // SRS extension
  transactionId?: string;    // SRS extension (FR-SP-2)

  constructor(params: {
    paymentId: number;
    amount: number;
    paymentDate?: Date;
    method: string;
    status?: PaymentStatus;
    orderId?: number;
    transactionId?: string;
  }) {
    this.paymentId = params.paymentId;
    this.amount = params.amount;
    this.paymentDate = params.paymentDate ?? clock.now();
    this.method = params.method;
    this.status = params.status ?? "PENDING";
    this.orderId = params.orderId;
    this.transactionId = params.transactionId;
  }

  /**
   * Diagram method & Sequence Step 25: processPayment()
   */
  processPayment(): void {
    if (this.amount <= 0) {
      this.status = "FAILED";
      throw new Error("Payment amount must be greater than zero");
    }
    this.status = "SUCCESSFUL";
  }

  /**
   * Diagram method: processRefund()
   */
  processRefund(): void {
    if (this.status !== "SUCCESSFUL") {
      throw new Error(`Cannot refund payment with status '${this.status}'`);
    }
    this.status = "REFUNDED";
  }
}
