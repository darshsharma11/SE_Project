export type DeliveryStatus =
  | "PENDING"
  | "ASSIGNED"
  | "ACCEPTED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export class Delivery {
  deliveryId: number;
  deliveryAddress: string;
  trackingNumber: string;
  status: DeliveryStatus;
  orderId?: number;     // SRS extension
  partnerId?: number;   // SRS extension

  constructor(params: {
    deliveryId: number;
    deliveryAddress: string;
    trackingNumber: string;
    status?: DeliveryStatus;
    orderId?: number;
    partnerId?: number;
  }) {
    this.deliveryId = params.deliveryId;
    this.deliveryAddress = params.deliveryAddress;
    this.trackingNumber = params.trackingNumber;
    this.status = params.status ?? "PENDING";
    this.orderId = params.orderId;
    this.partnerId = params.partnerId;
  }

  /**
   * Diagram method & Sequence Step 33: assignPartner()
   */
  assignPartner(partnerId: number): void {
    this.partnerId = partnerId;
    this.status = "ASSIGNED";
  }

  /**
   * Diagram method & Sequence Steps 35, 38: updateStatus()
   */
  updateStatus(newStatus: DeliveryStatus): void {
    this.status = newStatus;
  }

  /**
   * Diagram method: trackDelivery()
   */
  trackDelivery(): {
    trackingNumber: string;
    status: DeliveryStatus;
    deliveryAddress: string;
    partnerId?: number;
  } {
    return {
      trackingNumber: this.trackingNumber,
      status: this.status,
      deliveryAddress: this.deliveryAddress,
      partnerId: this.partnerId,
    };
  }
}
