import { prisma } from "@/lib/prisma";
import { Order, OrderStatus } from "@/domain/Order";
import { OrderItem } from "@/domain/OrderItem";

export class OrderRepository {
  static toDomain(row: {
    orderId: number;
    orderDate: Date;
    status: string;
    totalAmount: number;
    customerId: number;
    storeId: number;
    orderNumber: string;
    items?: Array<{
      orderItemId: number;
      quantity: number;
      unitPrice: number;
      orderId: number;
      productId: number;
    }>;
  }): Order {
    const items = row.items?.map(
      (i) =>
        new OrderItem({
          orderItemId: i.orderItemId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          orderId: i.orderId,
          productId: i.productId,
        })
    );

    return new Order({
      orderId: row.orderId,
      orderDate: row.orderDate,
      status: row.status as OrderStatus,
      totalAmount: row.totalAmount,
      customerId: row.customerId,
      storeId: row.storeId,
      orderNumber: row.orderNumber,
      items,
    });
  }

  static async findById(orderId: number): Promise<Order | null> {
    const row = await prisma.order.findUnique({
      where: { orderId },
      include: { items: true },
    });
    return row ? this.toDomain(row) : null;
  }

  static async findByCustomerId(customerId: number): Promise<Order[]> {
    const rows = await prisma.order.findMany({
      where: { customerId },
      include: { items: true, delivery: true, payment: true },
      orderBy: { orderDate: "desc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  static async findByStoreId(storeId: number): Promise<Order[]> {
    const rows = await prisma.order.findMany({
      where: { storeId },
      include: { items: true, delivery: true, payment: true },
      orderBy: { orderDate: "desc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  static async updateStatus(
    orderId: number,
    status: OrderStatus,
    note?: string
  ): Promise<void> {
    await prisma.$transaction([
      prisma.order.update({
        where: { orderId },
        data: { status },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId,
          status,
          note,
        },
      }),
    ]);
  }
}
