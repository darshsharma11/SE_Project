export class OrderItem {
  orderItemId: number;
  quantity: number;
  unitPrice: number;
  orderId?: number;    // SRS extension
  productId?: number;  // SRS extension

  constructor(params: {
    orderItemId: number;
    quantity: number;
    unitPrice: number;
    orderId?: number;
    productId?: number;
  }) {
    if (params.quantity <= 0) throw new Error("Order item quantity must be greater than zero");
    if (params.unitPrice < 0) throw new Error("Unit price cannot be negative");

    this.orderItemId = params.orderItemId;
    this.quantity = params.quantity;
    this.unitPrice = params.unitPrice;
    this.orderId = params.orderId;
    this.productId = params.productId;
  }

  /**
   * Diagram method: calculateSubtotal()
   */
  calculateSubtotal(): number {
    return Math.round(this.quantity * this.unitPrice);
  }
}
