/**
 * Platform Configuration & Business Rules Constants
 */

export const CONFIG = {
  CURRENCY: "INR",
  CURRENCY_SYMBOL: "₹",
  TIMEZONE: "Asia/Kolkata", // IST

  // Business Rules
  BR_MAX_DISCOUNT_PERCENT: 80, // Maximum allowed discount cap (BR-3)
  BR_CART_HOLD_MINUTES: 15,    // Cart price hold duration (BR-7)
  BR_ORDER_TIMEOUT_MINUTES: 15,// Order acceptance timeout (BR-6)

  // Expiry Proximity Bands (BR-5, hours remaining)
  EXPIRY_BANDS: {
    CRITICAL: { name: "Critical", maxHours: 6, label: "0-6h remaining" },
    URGENT: { name: "Urgent", maxHours: 24, label: "6-24h remaining" },
    SOON: { name: "Soon", maxHours: 72, label: "1-3 days remaining" },
    STANDARD: { name: "Standard", maxHours: Infinity, label: "3+ days remaining" },
  },
} as const;

export type ExpiryBand = "CRITICAL" | "URGENT" | "SOON" | "STANDARD";

/**
 * Computes the expiry band from the target expiry date and a reference 'now'.
 */
export function getExpiryBand(expiryDate: Date, now: Date): ExpiryBand {
  const diffHours = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours <= 6) return "CRITICAL";
  if (diffHours <= 24) return "URGENT";
  if (diffHours <= 72) return "SOON";
  return "STANDARD";
}
