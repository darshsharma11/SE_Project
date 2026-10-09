# Viva Demo Script

> Click-by-click walkthrough for the live defense/viva.
> Open five browser profiles (or incognito windows) before starting:
>
> | Profile | Account | URL |
> |---------|---------|-----|
> | A - Customer | customer@demo.com / demo123 | http://localhost:3000 |
> | B - Store 1 Owner | store1@demo.com / demo123 | http://localhost:3000 |
> | C - Store 2 Owner | store2@demo.com / demo123 | http://localhost:3000 |
> | D - Delivery Partner | partner@demo.com / demo123 | http://localhost:3000 |
> | E - Admin | admin@demo.com / demo123 | http://localhost:3000 |

---

## Setup (run once before demo)

```bash
npm install && npm run db:reset && npm run dev
```

The seed creates all demo accounts, two verified stores, products with near-expiry dates, and a delivery partner.

---

## Part (a): Search and Expiry-Based Dynamic Pricing — Steps 1-14

**Profile A (Customer)**

1. Go to `http://localhost:3000/marketplace`.
2. The page shows all ACTIVE, in-stock, non-expired products.
3. Note the green/amber/red **expiry band badges** (STANDARD / SOON / URGENT / CRITICAL).
4. In the search box, type **"milk"** and press Search.
5. Observe: only products matching "milk" appear. Out-of-stock and expired products are absent.
6. Click **Show Details** on any product.
7. Observe: `originalPrice`, `currentPrice`, `discountPercent`, `hoursRemaining` and the expiry band are shown.
8. Open `/trace` (Viva Trace link in Navbar).
9. Find the most recent `correlationId` prefixed `search-`.
10. Click it. Verify the trace shows **steps 1 through 14** in order:
    - Step 1: `searchProduct(productName)` Customer → Marketplace
    - Step 2: `getProductDetails()` Marketplace → Product
    - Step 4: `checkAvailability()` Product → InventoryItem
    - Step 6: `calculateCurrentPrice(Product)` → PricingEngine
    - Steps 7-13: pricing engine flow (getExpiryDetails, calculateDiscount, updatePrice, currentPrice)
    - Step 14: `displayProductAndPrice()` Marketplace → Customer

**Key talking point:** Every price is computed by `PricingEngine` on the server. The UI displays what the DB stores — no client-side calculation.

---

## Part (b): Advance the Clock and Watch Re-pricing — Steps 6-13

**Profile E (Admin)**

1. Go to `http://localhost:3000/admin`.
2. Under **Clock Control**, click **+6 hours** (or type `6` in the advance field and click Advance).
3. The virtual clock is now 6 hours ahead.
4. Under **Pricing Engine**, click **Trigger Decay Job** (calls `POST /api/v1/pricing/apply-decay`).
5. **Expected:** Products with `expiryThresholdHours >= 6` now show higher discount percentages.
6. Switch to **Profile A (Customer)**, refresh `/marketplace`.
7. Observe: prices have dropped. Red CRITICAL badges appear for products with < 6h left.
8. Go to `/trace`, find the `decay-` correlationId. Verify steps 6-13 appear for each recalculated product.

**Key talking point:** The pricing formula is `discount% = min(discountRate * hoursElapsedInWindow, maximumDiscount, 80%)`. Price = `max(originalPrice * (1 - discount%), minimumPriceFloor)` rounded to whole rupees. `minimumPriceFloor` is an SRS extension (see DECISIONS.md DEC-05).

---

## Part (c): Cart with Items from Two Different Stores — Steps 15-19

**Profile A (Customer)**

1. Go to `/marketplace`.
2. Find a product from **FreshMart** (Store 1). Click **Add to Cart** (quantity 2).
3. Observe: cart badge in navbar updates.
4. Find a product from **GreenGrocer** (Store 2). Click **Add to Cart** (quantity 1).
5. Go to `/cart`.
6. Observe: both items appear with their **locked prices** and **price-hold countdown timers** (15 minutes).
7. Note the `priceHoldExpiresAt` shown beside each item.
8. In `/trace`, find `addItem-` correlationId and verify **steps 15, 16, 17, 18, 19** appear in sequence.

**Key talking point:** Cart items from multiple stores are allowed. At checkout they are split into one Order per store. The 15-minute price hold is enforced by `CartItem.priceHoldExpiresAt` (SRS extension BR-7).

---

## Part (d): Successful Payment Through to Delivery — Steps 20-40

**Still in Profile A (Customer) — /cart**

1. Click **Checkout**.
2. Select payment method: **UPI**. Enter any UPI ID (e.g. `customer@upi`).
3. Click **Place Order**.
4. Expected: "Order placed successfully!" message appears. Two orders are listed (one per store).
5. Go to `/customer/dashboard`. Click **Track Order** on Order 1.
6. Observe: status = **PLACED** then quickly **CONFIRMED** (payment confirmed).

**Profile B (Store 1 Owner) — /store/orders**

7. The new order appears with a **15-minute countdown timer**.
8. Click **Accept Order**. Status changes to **PREPARING**.

**Profile D (Delivery Partner) — /delivery/dashboard**

9. The delivery assignment appears (Status: ASSIGNED).
10. Click **Accept Assignment**. Status changes to ACCEPTED.
11. *(Store is PREPARING)* Click **Mark as Picked Up — Out for Delivery**.
12. Status changes to OUT_FOR_DELIVERY.

**Profile A (Customer) — /orders/[id] tracking page**

13. Refresh. The step timeline updates: PREPARING → OUT_FOR_DELIVERY.
14. Observe: delivery partner name and vehicle number appear.
15. A notification badge appears in the navbar (bell icon).

**Profile D (Delivery Partner)**

16. Click **Confirm Delivery Completed**.

**Profile A (Customer)**

17. Refresh `/orders/[id]`. Status = **DELIVERED**. All steps filled in the timeline.
18. Go to `/notifications`. See "Your order has been delivered!" notification (unread). Click it to mark read.
19. Go to `/trace`. Find the `checkout-` correlationId.
20. Verify **steps 20 through 40** appear in order. Point out each arrow matches the sequence diagram PDF.

**Key talking points:**
- Steps 32-33: `createDelivery()` and `assignDelivery()` happen atomically at checkout (see DECISIONS.md DEC-04).
- Steps 35-37 and 38-40: each status update writes an `OrderStatusHistory` row and creates a `Notification`.
- The delivery partner can only mark "Out for Delivery" when the order is in PREPARING status (guarded in `DeliveryService.setOutForDelivery()`).

---

## Part (e): Failed Payment and Stock Release — Steps 41-45

**Profile A (Customer)**

1. Add a new item to cart from `/marketplace`.
2. Go to `/cart`, click **Checkout**.
3. Select **CARD**. Enter card number ending in **`0000`** (e.g. `4111 1111 1111 0000`).
4. Click **Place Order**.
5. Expected: error message "Payment authorization declined by simulated gateway".
6. Observe: no order appears in `/customer/dashboard`.
7. Go to `/marketplace` and check the same product: **stock is unchanged** (reservation was released).
8. Go to `/trace`, find the correlationId. Verify steps **41, 42, 43, 44, 45** appear:
   - Step 41: `paymentFailed` PaymentGateway → Payment
   - Step 42: `paymentFailed` Payment → Order
   - Step 43: `releaseReservedStock()` Order → InventoryItem
   - Step 44: `stockReleased` InventoryItem → Order
   - Step 45: `paymentFailed()` → Customer

**Key talking point:** The entire checkout is wrapped in a Prisma `$transaction`. On payment failure, stock reservation is released atomically so no stock is permanently locked. Raw card numbers are never persisted (PCI compliance, see DECISIONS.md DEC-10).

---

## Part (f): Out-of-Stock Branch — Steps 46-48

**Profile E (Admin) or Profile B (Store Owner)**

1. Go to the Admin panel or Store Portal.
2. Edit a product's inventory — set quantity to **0**.

**Profile A (Customer)**

3. Go to `/marketplace`. The product is no longer shown (search returns only in-stock products).
4. If you have the product in your cart already, try to **Checkout**.
5. Expected: "Product unavailable or removed" error — the checkout service blocks it.
6. Alternatively, use the Store Portal to reduce quantity below reserved quantity during an active flow.
7. In `/trace`, verify steps **46, 47, 48** appear for out-of-stock scenarios.

**Key talking point:** `InventoryItem.checkAvailability()` returns `isAvailable: false` when `quantity - reservedQuantity < requested`. This propagates as `stockUnavailable` (step 46) → `productUnavailable()` (steps 47-48).

---

## Part (g): Viva Trace Walkthrough of Steps 1–40

**Open `/trace` in any browser**

1. The Viva Trace page lists all recent flows with their `correlationId` prefix.
2. Select the most recent **checkout** flow (prefix `checkout-...`).
3. Click through each step:
   - Steps 1-14: Module 1 — search, price calculation
   - Steps 15-19: cart add with price hold
   - Steps 20-31: checkout, order creation, payment, stock reduction
   - Steps 32-40: delivery creation, assignment, acceptance, out-for-delivery, delivered
4. For each step, the trace shows: **step number, message label, from entity, to entity, timestamp, and details payload**.
5. Show that the `correlationId` is shared across the entire flow (set at checkout, passed to all services).
6. Show a **failure flow** (`correlationId` for a failed payment) — steps 41-45 appear.
7. Show an **out-of-stock flow** — steps 46-48 appear.

**Key talking point:** The `TraceLog` table is an SRS extension (documented in TRACEABILITY.md). Every method that implements a sequence diagram message calls `trace.step(n, label, from, to)` with the shared `correlationId`. This makes the entire flow visible as a live sequence diagram in the viva.

---

## Demo Reset (if needed mid-demo)

```bash
npm run db:reset
npm run dev
```

This resets the database to seed state with all demo accounts and products intact.
