import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { NotificationType } from "@/domain/Notification";

export interface SendNotificationParams {
  userId: number;
  type: NotificationType;
  message: string;
  correlationId?: string;
}

export class NotificationService {
  /**
   * Sequence Steps 36, 39: sendNotification() -> Notification
   */
  async sendNotification(params: SendNotificationParams) {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        message: params.message,
        sentAt: clock.now(),
        isRead: false,
      },
    });

    return notification;
  }

  async getNotificationsForUser(userId: number) {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { sentAt: "desc" },
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return {
      notifications,
      unreadCount,
    };
  }

  async markAsRead(notificationId: number, userId: number) {
    const notification = await prisma.notification.findUnique({
      where: { notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found or unauthorized");
    }

    return prisma.notification.update({
      where: { notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: number) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}

export const notificationService = new NotificationService();
