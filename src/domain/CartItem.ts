export class CartItem {
  cartItemId: number;
  quantity: number;
  price: number;
  cartId?: number;                // SRS extension
  productId?: number;           // SRS extension
  priceHoldExpiresAt?: Date;    // SRS extension (BR-7: 15-minute price hold)

  constructor(params: {
    cartItemId: number;
    quantity: number;
    price: number;
    cartId?: number;
    productId?: number;
    priceHoldExpiresAt?: Date;
  }) {
    if (params.quantity <= 0) throw new Error("Cart item quantity must be greater than zero");
    if (params.price < 0) throw new Error("Cart item price cannot be negative");

    this.cartItemId = params.cartItemId;
    this.quantity = params.quantity;
    this.price = params.price;
    this.cartId = params.cartId;
    this.productId = params.productId;
    this.priceHoldExpiresAt = params.priceHoldExpiresAt;
  }

  /**
   * Diagram method: updateQuantity() with inventory validation.
   */
  updateQuantity(newQuantity: number, inventory?: { checkAvailability: (qty: number) => { isAvailable: boolean } }): void {
    if (newQuantity <= 0) throw new Error("Quantity must be greater than zero");
    if (inventory) {
      const availability = inventory.checkAvailability(newQuantity);
      if (!availability.isAvailable) {
        throw new Error("stockUnavailable: insufficient unreserved stock");
      }
    }
    this.quantity = newQuantity;
  }

  /**
   * Check if the 15-minute price hold has expired (BR-7).
   */
  isPriceHoldExpired(now: Date): boolean {
    if (!this.priceHoldExpiresAt) return false;
    return this.priceHoldExpiresAt.getTime() <= now.getTime();
  }
}
