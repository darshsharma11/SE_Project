import { EventEmitter } from "events";

export type EventType =
  | "ORDER_CONFIRMED"
  | "INVENTORY_COMMITTED"
  | "ORDER_CANCELLED"
  | "STOCK_RELEASED";

export interface OrderConfirmedPayload {
  orderIds: number[];
  orderNumbers: string[];
  totalAmount: number;
  customerId: number;
  timestamp: Date;
}

export interface InventoryCommittedPayload {
  items: Array<{
    productId: number;
    quantity: number;
    remainingQuantity: number;
  }>;
  timestamp: Date;
}

export interface OrderCancelledPayload {
  orderIds: number[];
  reason: string;
  timestamp: Date;
}

export interface StockReleasedPayload {
  items: Array<{
    productId: number;
    quantity: number;
  }>;
  timestamp: Date;
}

class AppEventBus extends EventEmitter {
  private history: Array<{ event: EventType; payload: any; timestamp: Date }> = [];

  constructor() {
    super();
    // Allow ample listeners without warning
    this.setMaxListeners(50);
  }

  emitEvent<T = any>(event: EventType, payload: T): boolean {
    const entry = {
      event,
      payload,
      timestamp: new Date(),
    };
    this.history.push(entry);
    // Keep last 100 events in memory
    if (this.history.length > 100) {
      this.history.shift();
    }
    return this.emit(event, payload);
  }

  getEventHistory(): Array<{ event: EventType; payload: any; timestamp: Date }> {
    return [...this.history];
  }
}

export const eventBus = new AppEventBus();
