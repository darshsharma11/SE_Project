import { prisma } from "@/lib/prisma";
import { Payment, PaymentStatus } from "@/domain/Payment";

export class PaymentRepository {
  static toDomain(row: {
    paymentId: number;
    amount: number;
    paymentDate: Date;
    method: string;
    status: string;
    orderId: number;
    transactionId: string | null;
  }): Payment {
    return new Payment({
      paymentId: row.paymentId,
      amount: row.amount,
      paymentDate: row.paymentDate,
      method: row.method,
      status: row.status as PaymentStatus,
      orderId: row.orderId,
      transactionId: row.transactionId ?? undefined,
    });
  }

  static async findByOrderId(orderId: number): Promise<Payment | null> {
    const row = await prisma.payment.findUnique({ where: { orderId } });
    return row ? this.toDomain(row) : null;
  }

  static async create(payment: Payment): Promise<Payment> {
    const row = await prisma.payment.create({
      data: {
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        method: payment.method,
        status: payment.status,
        orderId: payment.orderId!,
        transactionId: payment.transactionId,
      },
    });
    return this.toDomain(row);
  }
}
