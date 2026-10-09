import { clock } from "@/lib/clock";

export class PricingRule {
  ruleId: number;
  discountRate: number;            // e.g. 0.05 for 5% per hour decay
  expiryThresholdHours: number;    // e.g. 24 hours threshold
  maximumDiscount: number;         // e.g. 0.80 (80%)
  minimumPriceFloor: number;       // SRS extension (BR-3)
  category?: string;               // SRS extension
  storeId?: number;                // SRS extension

  constructor(params: {
    ruleId: number;
    discountRate: number;
    expiryThresholdHours: number;
    maximumDiscount: number;
    minimumPriceFloor?: number;
    category?: string;
    storeId?: number;
  }) {
    this.ruleId = params.ruleId;
    this.discountRate = params.discountRate;
    this.expiryThresholdHours = params.expiryThresholdHours;
    this.maximumDiscount = params.maximumDiscount;
    this.minimumPriceFloor = params.minimumPriceFloor ?? 1.0;
    this.category = params.category;
    this.storeId = params.storeId;
  }

  /**
   * Exposes the minimum price floor.
   */
  get floor(): number {
    return this.minimumPriceFloor;
  }

  /**
   * Sequence Step 9 & 10: calculateDiscount(expiryTime, now)
   * Returns the discount fraction (0.0 to 0.80).
   */
  calculateDiscount(expiryTime: Date, now: Date = clock.now()): number {
    const diffMs = expiryTime.getTime() - now.getTime();
    const hoursRemaining = diffMs / (1000 * 60 * 60);

    if (hoursRemaining <= 0) {
      // Product has expired
      return Math.min(this.maximumDiscount, 0.80);
    }

    if (hoursRemaining > this.expiryThresholdHours) {
      // Outside the decay window: full price
      return 0.0;
    }

    // Inside the decay window:
    const hoursElapsedInWindow = this.expiryThresholdHours - hoursRemaining;
    const computedDiscount = this.discountRate * hoursElapsedInWindow;

    // Cap at minimum of (computed, maximumDiscount, 80%) per BR-3
    return Math.min(computedDiscount, this.maximumDiscount, 0.80);
  }
}

