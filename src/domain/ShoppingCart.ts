import { CartItem } from "./CartItem";
import { Product } from "./Product";
import { InventoryItem } from "./InventoryItem";
import { PricingEngine } from "./PricingEngine";
import { clock } from "@/lib/clock";
import { trace } from "@/lib/trace";

export interface AddItemOptions {
  inventory?: InventoryItem;
  pricingEngine?: PricingEngine;
  correlationId?: string;
  now?: Date;
  cartItemId?: number;
}

export class ShoppingCart {
  cartId: number;
  totalAmount: number;
  customerId?: number;      // SRS extension
  items: CartItem[];        // SRS extension

  constructor(params: {
    cartId: number;
    totalAmount?: number;
    customerId?: number;
    items?: CartItem[];
  }) {
    this.cartId = params.cartId;
    this.customerId = params.customerId;
    this.items = params.items ?? [];
    this.totalAmount = params.totalAmount ?? this.calculateTotal();
  }

  /**
   * Sequence Step 15 to 19: addItem(Product, quantity)
   * 15 addItem(Product, quantity)            Customer -> ShoppingCart
   * 16 getCurrentPrice()                     ShoppingCart -> Product
   * 17 currentPrice                          Product -> ShoppingCart
   * 18 calculateTotal()                      ShoppingCart -> ShoppingCart
   * 19 cartUpdated                           ShoppingCart -> Customer
   */
  async addItem(
    product: Product,
    quantity: number,
    options?: AddItemOptions
  ): Promise<{ cartUpdated: boolean; item: CartItem }>;
  addItem(item: CartItem): void;
  addItem(
    productOrItem: Product | CartItem,
    quantity?: number,
    options?: AddItemOptions
  ): Promise<{ cartUpdated: boolean; item: CartItem }> | void {
    // Legacy / simple CartItem signature for tests
    if (productOrItem instanceof CartItem || ("cartItemId" in productOrItem && !("originalPrice" in productOrItem))) {
      const item = productOrItem as CartItem;
      const existingIndex = this.items.findIndex(
        (i) => i.productId === item.productId
      );
      if (existingIndex >= 0) {
        this.items[existingIndex].quantity += item.quantity;
        this.items[existingIndex].price = item.price;
        this.items[existingIndex].priceHoldExpiresAt = item.priceHoldExpiresAt;
      } else {
        this.items.push(item);
      }
      this.calculateTotal();
      return;
    }

    const product = productOrItem as Product;
    const qty = quantity ?? 1;
    if (qty <= 0) {
      throw new Error("Quantity must be greater than zero");
    }

    const correlationId = options?.correlationId;
    const now = options?.now ?? clock.now();

    // Async execution path for sequence tracing and domain validations
    return (async () => {
      // Step 15: Customer -> ShoppingCart addItem(Product, quantity)
      if (correlationId) {
        await trace.step({
          correlationId,
          stepNumber: 15,
          label: "addItem(Product, quantity)",
          from: "Customer",
          to: "ShoppingCart",
          details: { productId: product.productId, quantity: qty },
        });
      }

      // 1. Validate availability
      if (options?.inventory) {
        const availability = options.inventory.checkAvailability(qty);
        if (!availability.isAvailable) {
          if (correlationId) {
            await trace.step({
              correlationId,
              stepNumber: 46,
              label: "stockUnavailable",
              from: "InventoryItem",
              to: "Product",
              details: { productId: product.productId, requested: qty, available: availability.available },
            });
            await trace.step({
              correlationId,
              stepNumber: 47,
              label: "productUnavailable()",
              from: "Product",
              to: "ShoppingCart",
            });
            await trace.step({
              correlationId,
              stepNumber: 48,
              label: "productUnavailable()",
              from: "ShoppingCart",
              to: "Customer",
            });
          }
          throw new Error("stockUnavailable: insufficient unreserved stock");
        }
      }

      // Step 16: ShoppingCart -> Product getCurrentPrice()
      if (correlationId) {
        await trace.step({
          correlationId,
          stepNumber: 16,
          label: "getCurrentPrice()",
          from: "ShoppingCart",
          to: "Product",
          details: { productId: product.productId },
        });
      }

      // Step 17: Product -> ShoppingCart currentPrice
      const currentPrice = options?.pricingEngine
        ? await options.pricingEngine.calculatePrice(product)
        : product.getDetails().currentPrice;

      if (correlationId) {
        await trace.step({
          correlationId,
          stepNumber: 17,
          label: "currentPrice",
          from: "Product",
          to: "ShoppingCart",
          details: { currentPrice },
        });
      }

      // Set CartItem with 15-minute price hold (BR-7)
      const holdExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
      let updatedItem: CartItem;

      const existingIndex = this.items.findIndex(
        (i) => i.productId === product.productId
      );

      if (existingIndex >= 0) {
        this.items[existingIndex].quantity += qty;
        this.items[existingIndex].price = currentPrice;
        this.items[existingIndex].priceHoldExpiresAt = holdExpiresAt;
        updatedItem = this.items[existingIndex];
      } else {
        updatedItem = new CartItem({
          cartItemId: options?.cartItemId ?? Date.now(),
          quantity: qty,
          price: currentPrice,
          cartId: this.cartId,
          productId: product.productId,
          priceHoldExpiresAt: holdExpiresAt,
        });
        this.items.push(updatedItem);
      }

      // Step 18: ShoppingCart -> ShoppingCart calculateTotal()
      this.calculateTotal();
      if (correlationId) {
        await trace.step({
          correlationId,
          stepNumber: 18,
          label: "calculateTotal()",
          from: "ShoppingCart",
          to: "ShoppingCart",
          details: { totalAmount: this.totalAmount },
        });
      }

      // Step 19: ShoppingCart -> Customer cartUpdated
      if (correlationId) {
        await trace.step({
          correlationId,
          stepNumber: 19,
          label: "cartUpdated",
          from: "ShoppingCart",
          to: "Customer",
          details: { totalAmount: this.totalAmount, itemCount: this.items.length },
        });
      }

      return { cartUpdated: true, item: updatedItem };
    })();
  }

  /**
   * Diagram method: removeItem()
   */
  removeItem(cartItemId: number): void {
    this.items = this.items.filter((i) => i.cartItemId !== cartItemId);
    this.calculateTotal();
  }

  /**
   * Clear all items (e.g. after successful checkout commit)
   */
  clear(): void {
    this.items = [];
    this.totalAmount = 0;
  }

  /**
   * Diagram method & Sequence Step 18: calculateTotal()
   */
  calculateTotal(): number {
    const sum = this.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    this.totalAmount = Math.round(sum);
    return this.totalAmount;
  }
}
