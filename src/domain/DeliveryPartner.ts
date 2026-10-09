import { User } from "./User";

export class DeliveryPartner extends User {
  partnerId: number;
  vehicleNumber: string;

  constructor(params: {
    userId: number;
    name: string;
    email: string;
    passwordHash: string;
    phone: string;
    partnerId: number;
    vehicleNumber: string;
  }) {
    super({
      userId: params.userId,
      name: params.name,
      email: params.email,
      passwordHash: params.passwordHash,
      phone: params.phone,
    });
    this.partnerId = params.partnerId;
    this.vehicleNumber = params.vehicleNumber;
  }

  /**
   * Sequence Step 34: acceptDelivery() -> deliveryAccepted
   */
  acceptDelivery(delivery?: { status: string; updateStatus?: (s: any) => void }): void {
    if (delivery) {
      if (typeof delivery.updateStatus === "function") {
        delivery.updateStatus("ACCEPTED");
      } else {
        delivery.status = "ACCEPTED";
      }
    }
  }

  declineDelivery(): void {
    // Reassigned to next available partner
  }

  /**
   * Diagram method & Sequence Steps 35, 38: updateDeliveryStatus()
   */
  updateDeliveryStatus(
    delivery?: { status: string; updateStatus?: (s: any) => void },
    newStatus?: any
  ): void {
    if (delivery && newStatus) {
      if (typeof delivery.updateStatus === "function") {
        delivery.updateStatus(newStatus);
      } else {
        delivery.status = newStatus;
      }
    }
  }
}
