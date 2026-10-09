import { prisma } from "@/lib/prisma";
import { Delivery, DeliveryStatus } from "@/domain/Delivery";

export class DeliveryRepository {
  static toDomain(row: {
    deliveryId: number;
    deliveryAddress: string;
    trackingNumber: string;
    status: string;
    orderId: number;
    partnerId: number | null;
  }): Delivery {
    return new Delivery({
      deliveryId: row.deliveryId,
      deliveryAddress: row.deliveryAddress,
      trackingNumber: row.trackingNumber,
      status: row.status as DeliveryStatus,
      orderId: row.orderId,
      partnerId: row.partnerId ?? undefined,
    });
  }

  static async findByOrderId(orderId: number): Promise<Delivery | null> {
    const row = await prisma.delivery.findUnique({ where: { orderId } });
    return row ? this.toDomain(row) : null;
  }

  static async findByPartnerId(partnerId: number): Promise<Delivery[]> {
    const rows = await prisma.delivery.findMany({
      where: { partnerId },
      include: { order: true },
    });
    return rows.map((r) => this.toDomain(r));
  }

  static async findAvailableDeliveries(): Promise<Delivery[]> {
    const rows = await prisma.delivery.findMany({
      where: { partnerId: null, status: "PENDING" },
      include: { order: true },
    });
    return rows.map((r) => this.toDomain(r));
  }

  static async updateStatus(
    deliveryId: number,
    status: DeliveryStatus
  ): Promise<void> {
    await prisma.delivery.update({
      where: { deliveryId },
      data: { status },
    });
  }

  static async assignPartner(
    deliveryId: number,
    partnerId: number
  ): Promise<void> {
    await prisma.delivery.update({
      where: { deliveryId },
      data: {
        partnerId,
        status: "ASSIGNED",
      },
    });
  }
}
