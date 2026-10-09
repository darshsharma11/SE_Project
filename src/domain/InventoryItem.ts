export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface StockAvailability {
  available: number;
  stockStatus: StockStatus;
  isAvailable: boolean;
}

export class InventoryItem {
  inventoryId: number;
  quantity: number;
  reservedQuantity: number;
  productId?: number; // SRS extension

  constructor(params: {
    inventoryId: number;
    quantity: number;
    reservedQuantity: number;
    productId?: number;
  }) {
    if (params.quantity < 0) throw new Error("Quantity cannot be negative");
    if (params.reservedQuantity < 0) throw new Error("Reserved quantity cannot be negative");
    if (params.reservedQuantity > params.quantity) {
      throw new Error("Reserved quantity cannot exceed total quantity");
    }

    this.inventoryId = params.inventoryId;
    this.quantity = params.quantity;
    this.reservedQuantity = params.reservedQuantity;
    this.productId = params.productId;
  }

  /**
   * Sequence Step 4: checkAvailability()
   * Returns available = quantity - reservedQuantity and stockStatus.
   */
  checkAvailability(requestedQty = 1): StockAvailability {
    const available = this.quantity - this.reservedQuantity;
    let stockStatus: StockStatus = "IN_STOCK";
    if (available <= 0) {
      stockStatus = "OUT_OF_STOCK";
    } else if (available < 5) {
      stockStatus = "LOW_STOCK";
    }

    return {
      available,
      stockStatus,
      isAvailable: available >= requestedQty,
    };
  }

  /**
   * Diagram method: updateQuantity(delta)
   */
  updateQuantity(delta: number): void {
    const newQuantity = this.quantity + delta;
    if (newQuantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
    if (newQuantity < this.reservedQuantity) {
      throw new Error("New quantity cannot be less than reserved quantity");
    }
    this.quantity = newQuantity;
  }

  /**
   * Sequence Step 23: reserveStock(quantity)
   * Typed stub for Module 2.
   */
  reserveStock(quantity: number): void {
    if (quantity <= 0) throw new Error("Quantity to reserve must be greater than 0");
    const { available } = this.checkAvailability(quantity);
    if (available < quantity) {
      throw new Error("stockUnavailable: insufficient unreserved stock");
    }
    this.reservedQuantity += quantity;
  }

  /**
   * Sequence Step 30: reduceStock(quantity)
   * Typed stub for Module 2.
   */
  reduceStock(quantity: number): void {
    if (quantity <= 0) throw new Error("Quantity to reduce must be greater than 0");
    if (this.reservedQuantity < quantity) {
      throw new Error("Cannot reduce stock exceeding reserved quantity");
    }
    this.quantity -= quantity;
    this.reservedQuantity -= quantity;
  }

  /**
   * Sequence Step 43: releaseReservedStock()
   * Typed stub for Module 2.
   */
  releaseReservedStock(quantity: number): void {
    if (quantity <= 0) throw new Error("Quantity to release must be greater than 0");
    if (this.reservedQuantity < quantity) {
      throw new Error("Cannot release more stock than currently reserved");
    }
    this.reservedQuantity -= quantity;
  }
}

