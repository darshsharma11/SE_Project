import { OrderItem } from "./OrderItem";
import { clock } from "@/lib/clock";

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export class Order {
  orderId: number;
  orderDate: Date;
  status: OrderStatus;
  totalAmount: number;
  customerId?: number;  // SRS extension
  storeId?: number;     // SRS extension
  orderNumber?: string; // SRS extension
  items?: OrderItem[];  // SRS extension

  constructor(params: {
    orderId: number;
    orderDate?: Date;
    status?: OrderStatus;
    totalAmount: number;
    customerId?: number;
    storeId?: number;
    orderNumber?: string;
    items?: OrderItem[];
  }) {
    this.orderId = params.orderId;
    this.orderDate = params.orderDate ?? clock.now();
    this.status = params.status ?? "PLACED";
    this.totalAmount = params.totalAmount;
    this.customerId = params.customerId;
    this.storeId = params.storeId;
    this.orderNumber = params.orderNumber;
    this.items = params.items ?? [];
  }

  /**
   * Diagram method & Sequence Step 21: createOrder()
   */
  createOrder(): void {
    this.status = "PLACED";
  }

  /**
   * Diagram method & Sequence Step 29: confirmOrder() / updateStatus("Confirmed")
   */
  confirmOrder(): void {
    this.updateStatus("CONFIRMED");
  }

  /**
   * Diagram method: cancelOrder()
   * Allowed only while PLACED or CONFIRMED (per BR-6 / FR-OM-7).
   */
  cancelOrder(): void {
    if (this.status !== "PLACED" && this.status !== "CONFIRMED") {
      throw new Error(`Cannot cancel order in status '${this.status}'`);
    }
    this.updateStatus("CANCELLED");
  }

  /**
   * Diagram method & Sequence Step 29, 35, 38: updateStatus(status)
   */
  updateStatus(newStatus: OrderStatus): void {
    if (this.status === newStatus) return;

    const allowed = VALID_ORDER_TRANSITIONS[this.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Illegal order status transition from '${this.status}' to '${newStatus}'`
      );
    }
    this.status = newStatus;
  }
}
