import { prisma } from "@/lib/prisma";
import { Notification } from "@/domain/Notification";

export class NotificationRepository {
  static toDomain(row: {
    notificationId: number;
    message: string;
    type: string;
    sentAt: Date;
    userId: number;
  }): Notification {
    return new Notification({
      notificationId: row.notificationId,
      message: row.message,
      type: row.type,
      sentAt: row.sentAt,
      userId: row.userId,
    });
  }

  static async findByUserId(userId: number): Promise<Notification[]> {
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { sentAt: "desc" },
    });
    return rows.map((r) => this.toDomain(r));
  }

  static async create(data: {
    userId: number;
    message: string;
    type: string;
  }): Promise<Notification> {
    const row = await prisma.notification.create({
      data: {
        userId: data.userId,
        message: data.message,
        type: data.type,
      },
    });
    return this.toDomain(row);
  }
}
