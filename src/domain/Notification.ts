import { clock } from "@/lib/clock";

export type NotificationType =
  | "ORDER_CONFIRMATION"
  | "NEW_ORDER"
  | "ORDER_STATUS"
  | "DELIVERY_UPDATE"
  | "PRICE_HOLD_EXPIRED"
  | "PAYMENT_FAILED"
  | "ORDER_CANCELLED"
  | "ORDER_UPDATE"
  | "PRICE_DROP"
  | "EXPIRY_ALERT"
  | "SYSTEM";

export class Notification {
  notificationId: number;
  message: string;
  type: string;
  sentAt: Date;
  userId?: number;    // SRS extension
  isRead: boolean;    // SRS extension

  constructor(params: {
    notificationId: number;
    message: string;
    type: string;
    sentAt?: Date;
    userId?: number;
    isRead?: boolean;
  }) {
    this.notificationId = params.notificationId;
    this.message = params.message;
    this.type = params.type;
    this.sentAt = params.sentAt ?? clock.now();
    this.userId = params.userId;
    this.isRead = params.isRead ?? false;
  }

  /**
   * Diagram method & Sequence Step 36, 39: sendNotification()
   */
  sendNotification(): void {
    // Dispatches notification to user
  }

  markAsRead(): void {
    this.isRead = true;
  }
}
