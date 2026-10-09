import { clock } from "@/lib/clock";

export type ProductStatus =
  | "DRAFT"
  | "ACTIVE"
  | "RESERVED"
  | "SOLD"
  | "EXPIRED_REMOVED"
  | "MANUALLY_REMOVED";

const VALID_PRODUCT_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["RESERVED", "EXPIRED_REMOVED", "MANUALLY_REMOVED"],
  RESERVED: ["ACTIVE", "SOLD"],
  SOLD: [],
  EXPIRED_REMOVED: [],
  MANUALLY_REMOVED: [],
};

export interface ProductPriceHistoryEntry {
  price: number;
  calculatedAt: Date;
  reason?: string;
}

export class Product {
  productId: number;
  name: string;
  category: string;
  originalPrice: number;
  currentPrice: number;
  expiryDateTime: Date;
  status: ProductStatus;
  storeId?: number;       // SRS extension
  pricingRuleId?: number; // SRS extension
  priceHistory: ProductPriceHistoryEntry[] = [];

  constructor(params: {
    productId: number;
    name: string;
    category: string;
    originalPrice: number;
    currentPrice: number;
    expiryDateTime: Date;
    status: ProductStatus;
    storeId?: number;
    pricingRuleId?: number;
    now?: Date;
    skipExpiryCheck?: boolean;
  }) {
    const currentNow = params.now ?? clock.now();
    // Creation rejects expiry <= now (BR-4)
    if (
      !params.skipExpiryCheck &&
      params.expiryDateTime.getTime() <= currentNow.getTime()
    ) {
      throw new Error("Product creation rejected: expiry date must be in the future");
    }

    this.productId = params.productId;
    this.name = params.name;
    this.category = params.category;
    this.originalPrice = params.originalPrice;
    this.currentPrice = params.currentPrice;
    this.expiryDateTime = params.expiryDateTime;
    this.status = params.status;
    this.storeId = params.storeId;
    this.pricingRuleId = params.pricingRuleId;
  }

  /**
   * Transition product status with state-machine validation.
   */
  transitionStatus(newStatus: ProductStatus): void {
    if (this.status === newStatus) return;

    const allowed = VALID_PRODUCT_TRANSITIONS[this.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Illegal product status transition from '${this.status}' to '${newStatus}'`
      );
    }
    this.status = newStatus;
  }

  /**
   * Sequence Step 11: updatePrice(discountedPrice)
   */
  updatePrice(discountedPrice: number, reason = "PRICE_UPDATE"): void {
    if (discountedPrice < 0) {
      throw new Error("Product price cannot be negative");
    }
    const roundedPrice = Math.round(discountedPrice);
    if (this.currentPrice !== roundedPrice) {
      this.currentPrice = roundedPrice;
      this.priceHistory.push({
        price: roundedPrice,
        calculatedAt: clock.now(),
        reason,
      });
    }
  }

  /**
   * Sequence Step 2: getProductDetails()
   */
  getDetails(): {
    productId: number;
    name: string;
    category: string;
    originalPrice: number;
    currentPrice: number;
    expiryDateTime: Date;
    status: ProductStatus;
    storeId?: number;
    pricingRuleId?: number;
  } {
    return {
      productId: this.productId,
      name: this.name,
      category: this.category,
      originalPrice: this.originalPrice,
      currentPrice: this.currentPrice,
      expiryDateTime: this.expiryDateTime,
      status: this.status,
      storeId: this.storeId,
      pricingRuleId: this.pricingRuleId,
    };
  }

  /**
   * Sequence Step 7: getExpiryDetails()
   */
  getExpiryDetails(): Date {
    return this.expiryDateTime;
  }
}

