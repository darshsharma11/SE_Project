# SE_Project: Complete Functional Audit, Role Testing, and Sequence Validation

**Project Title:** Expiry-Based Grocery and Zero-Waste Marketplace  
**Author:** Rayyan Shaikh  
**Evaluation Target:** Final Functional Audit & Sequence Diagram Verification (Exp 4a / Exp 3)

---

## A. Complete Functionality Chart

| # | Module | Responsible Role | Frontend Page / Component | Backend API | Domain / Service / Repository | Database Models Involved | Expected Behavior | Test Scenario | Actual Result | Status |
|---|--------|------------------|---------------------------|-------------|-------------------------------|--------------------------|-------------------|---------------|---------------|--------|
| 1 | **Dynamic Pricing** | All | `/marketplace`, `Navbar` | `GET /api/v1/marketplace/search` | `PricingEngine`, `MarketplaceService` | `Product`, `PricingRule`, `InventoryItem`, `Store` | Active products decay progressively in expiry window; cap at 80% or maxDiscount; never exceed original price | Query products with 48h, 24h, 12h, 6h, 0h remaining | Decay rates match category rules; 80% cap enforced; prices floored and capped correctly | **PASS** |
| 2 | **Authoritative Pricing Engine** | Customer | `/products/[id]`, `/cart` | `GET /api/v1/products/[id]`, `GET /api/v1/cart` | `PricingEngine.calculateAuthoritativePrice` | `Product`, `PricingRule`, `CartItem`, `PriceHistory` | Identical price computed across search, details, cart, price hold, and checkout | Load product details and add to cart; compare price across layers | Identical price verified across all layers; no fallback divergence | **PASS** |
| 3 | **Product Availability** | Customer | `/marketplace`, `/products/[id]` | `GET /api/v1/marketplace/search`, `GET /api/v1/products/[id]` | `MarketplaceService`, `ProductRepository` | `Product`, `Store`, `InventoryItem` | Reject expired, inactive, out-of-stock, and unverified-store products | Fetch product details for expired/unverified/OOS item | Returns 404 / null; expired product automatically transitions to `EXPIRED_REMOVED` | **PASS** |
| 4 | **15-Min Price Hold** | Customer | `/cart` | `GET /api/v1/cart`, `POST /api/v1/cart/items` | `CartService`, `ShoppingCart`, `CartItem` | `ShoppingCart`, `CartItem`, `Product` | 15-minute price hold locked per cart item; live countdown ticker; expired hold flags price change | Add item to cart; advance clock 10 min (valid), then 20 min (expired) | `isHoldExpired: false` within 15 min; `isHoldExpired: true` after 15 min | **PASS** |
| 5 | **Cart Management** | Customer | `/cart` | `POST /api/v1/cart/items`, `PATCH /api/v1/cart/items/[id]`, `DELETE /api/v1/cart/items/[id]` | `CartService`, `ShoppingCart` | `ShoppingCart`, `CartItem`, `InventoryItem` | Add items, adjust quantity, delete item, validate unreserved stock | Add item exceeding stock; increment/decrement quantity | Throws `stockUnavailable`; quantity changes update total correctly | **PASS** |
| 6 | **Checkout & Stock Reservation** | Customer | `/cart` | `POST /api/v1/cart/checkout` | `CheckoutService`, `InventoryItem` | `Order`, `OrderItem`, `InventoryItem`, `Payment` | Multi-store cart partitioned into store orders; stock atomically reserved; idempotency enforced | Checkout with 2 items from different stores | 2 separate orders created; stock reserved in transaction; duplicate correlationId returns existing order | **PASS** |
| 7 | **Payment Processing & Failure Rollback** | Customer | `/cart` | `POST /api/v1/cart/checkout` | `PaymentService`, `CheckoutService` | `Payment`, `Order`, `InventoryItem` | Mock payment authorized on valid card/UPI; failed payment cancels orders and restores reserved stock | Checkout with card ending in `0000` or `simulateFailure: true` | Payment marked `FAILED`; orders `CANCELLED`; stock reserved released back to available | **PASS** |
| 8 | **Price Change Reconfirmation (Path D)** | Customer | `/cart` | `POST /api/v1/cart/checkout` | `CheckoutService`, `PricingEngine` | `CartItem`, `Product`, `Order` | If price hold expires and decay price changes before checkout, require customer confirmation | Checkout without confirm when price changed; then checkout with confirm | Blocks with `priceChanged: true`; confirms with updated price and completes order | **PASS** |
| 9 | **Order Acceptance & Rejection** | Store Owner | `/store/orders` | `POST /api/v1/store/orders/[id]/accept`, `POST /api/v1/store/orders/[id]/reject` | `StoreOrderService`, `Order` | `Order`, `OrderStatusHistory`, `InventoryItem`, `Payment` | Store owner accepts order (transitions to `PREPARING`) or rejects order (refunds payment and restores stock) | Accept placed order; reject another order | Status becomes `PREPARING`; rejected order refunds payment and restores stock | **PASS** |
| 10 | **Order Sweeper** | Store Owner / Admin | `/store/orders`, `/admin` | `POST /api/v1/store/orders/sweep` | `StoreOrderService.sweepUnrespondedOrders` | `Order`, `Payment`, `InventoryItem` | Auto-cancels and refunds orders unresponded for >15 minutes; rejects negative/invalid timeouts | Trigger sweep with 15 min cutoff; test negative timeout | Cancels overdue orders idempotently; returns 400 for negative/invalid inputs | **PASS** |
| 11 | **Delivery Lifecycle** | Delivery Partner | `/delivery/dashboard` | `POST /api/v1/delivery/[id]/accept`, `out-for-delivery`, `delivered` | `DeliveryService`, `Delivery` | `Delivery`, `Order`, `Notification` | Valid state transitions: `PENDING` → `ASSIGNED` → `ACCEPTED` → `OUT_FOR_DELIVERY` → `DELIVERED`; customer notifications | Execute step-by-step delivery updates; attempt illegal transition | Transitions update database, notify customer; illegal transition throws `invalidStatusTransition` | **PASS** |
| 12 | **Customer Notifications** | Customer | `/notifications`, `Navbar` | `GET /api/v1/notifications`, `PATCH /api/v1/notifications/[id]` | `NotificationService` | `Notification` | Real-time notifications for order confirmation, out-for-delivery, and delivery completed | Place order and advance delivery stages | Notifications appear for recipient customer; unread counter updates; mark read works | **PASS** |
| 13 | **Store Product & Pricing Management** | Store Owner | `/store` | `GET/POST /api/v1/store/products`, `PUT /api/v1/store/pricing-rules` | `ProductRepository`, `PricingRuleRepository` | `Product`, `PricingRule`, `InventoryItem`, `Store` | Create/edit products and category pricing rules; strict store ownership enforced | Create product; attempt to modify another store's pricing rule | Product created; unauthorized rule modification rejected with 403 Forbidden | **PASS** |
| 14 | **Admin Clock & Scheduled Jobs** | Administrator | `/admin/dashboard` | `POST /api/v1/admin/demo/advance-time`, `POST /api/v1/admin/jobs/pricing` | `ClockService`, `runPricingJob` | `Product`, `PriceHistory` | Advance platform clock; trigger decay recalculation; verify and suspend stores | Advance clock by 6 hours; run pricing job; verify unverified store | Clock offset updates; decay job recalculates prices and records price history | **PASS** |
| 15 | **Demo Role Switcher** | All | `Navbar` | `POST /api/v1/auth/demo-switch`, `GET /api/v1/auth/me` | `lib/auth` | `User`, `Customer`, `StoreOwner`, `DeliveryPartner`, `Administrator` | Instant role switching between Customer, Store Owner, Delivery Partner, and Admin without login | Click role switch buttons repeatedly | Signed HTTP-only JWT session updated; dashboard, permissions, and API user match instantly | **PASS** |

---

## B. Role-Permission Matrix

| Operation / Feature | Customer (`Rahul Verma`) | Store Owner (`Ramesh Patel`) | Delivery Partner (`Vikram Singh`) | Administrator (`Admin Officer`) |
| :--- | :---: | :---: | :---: | :---: |
| Browse Marketplace & Search Products | ✅ | ✅ | ✅ | ✅ |
| View Product Expiry & Price Breakdown | ✅ | ✅ | ✅ | ✅ |
| Add Products to Cart (15-min Price Hold) | ✅ | ❌ | ❌ | ❌ |
| Checkout & Order Placement | ✅ | ❌ | ❌ | ❌ |
| View Personal Order History & Tracking | ✅ (Own orders) | ❌ | ❌ | ❌ |
| Receive Order & Delivery Notifications | ✅ (Own notifications)| ❌ | ❌ | ❌ |
| Manage Store Catalog & Inventory | ❌ | ✅ (Own store only) | ❌ | ✅ (Admin override) |
| Configure Store Pricing Rules | ❌ | ✅ (Own store only) | ❌ | ✅ |
| Accept / Reject Store Orders | ❌ | ✅ (Own store only) | ❌ | ❌ |
| View Assigned Deliveries | ❌ | ❌ | ✅ (Assigned only) | ❌ |
| Update Delivery Status (Accept → Deliver) | ❌ | ❌ | ✅ (Assigned only) | ❌ |
| Verify / Suspend Stores | ❌ | ❌ | ❌ | ✅ |
| Advance Virtual Demo Clock | ❌ | ❌ | ❌ | ✅ |
| Trigger Dynamic Pricing Decay Job | ❌ | ❌ | ❌ | ✅ |
| Trigger Order Timeout Sweeper | ❌ | ✅ (Store level) | ❌ | ✅ |
| Inspect Sequence Traces (`/trace`) | ✅ | ✅ | ✅ | ✅ |

*Note: All permissions are enforced server-side in API routes and domain services, not merely by hiding buttons in the UI.*

---

## C. Sequence-Diagram Traceability Matrix (All 48 Messages)

Authoritative mapping of the 48 sequence messages from `Exp4a(1).pdf`:

| Step | Sequence Diagram Message Label | From Entity | To Entity | Implementing Function & File | Test Verification | Status |
|:---:|---|---|---|---|---|:---:|
| **1** | `searchProduct(productName)` | Customer | Marketplace | `MarketplaceService.searchProduct` ([MarketplaceService.ts](file:///d:/SE_Project-main/src/services/MarketplaceService.ts#L66)) | `module1.test.ts` | **PASS** |
| **2** | `getProductDetails()` | Marketplace | Product | `Product.getDetails` ([Product.ts](file:///d:/SE_Project-main/src/domain/Product.ts#L70)) | `module1.test.ts` | **PASS** |
| **3** | `productDetails` | Product | Marketplace | Return payload from `Product.getDetails` | `module1.test.ts` | **PASS** |
| **4** | `checkAvailability()` | Product | InventoryItem | `InventoryItem.checkAvailability` ([InventoryItem.ts](file:///d:/SE_Project-main/src/domain/InventoryItem.ts#L37)) | `module1.test.ts` | **PASS** |
| **5** | `stockStatus` | InventoryItem | Product | Return `{ available, stockStatus, isAvailable }` | `module1.test.ts` | **PASS** |
| **6** | `calculateCurrentPrice(Product)` | Marketplace | PricingEngine | `PricingEngine.calculatePriceWithTrace` ([PricingEngine.ts](file:///d:/SE_Project-main/src/domain/PricingEngine.ts#L22)) | `module1.test.ts` | **PASS** |
| **7** | `getExpiryDetails()` | PricingEngine | Product | `Product.getExpiryDetails` ([Product.ts](file:///d:/SE_Project-main/src/domain/Product.ts#L90)) | `module1.test.ts` | **PASS** |
| **8** | `expiryDateTime` | Product | PricingEngine | Return `product.expiryDateTime` | `module1.test.ts` | **PASS** |
| **9** | `calculateDiscount(expiryTime)` | PricingEngine | PricingRule | `PricingRule.calculateDiscount` ([PricingRule.ts](file:///d:/SE_Project-main/src/domain/PricingRule.ts#L41)) | `domain.test.ts` | **PASS** |
| **10** | `discountRate` | PricingRule | PricingEngine | Return discount fraction (capped at maxDiscount / 0.80) | `domain.test.ts` | **PASS** |
| **11** | `updatePrice(discountedPrice)` | PricingEngine | Product | `Product.updatePrice` ([Product.ts](file:///d:/SE_Project-main/src/domain/Product.ts#L80)) | `module1.test.ts` | **PASS** |
| **12** | `priceUpdated` | Product | PricingEngine | Return confirmation from `Product.updatePrice` | `module1.test.ts` | **PASS** |
| **13** | `currentPrice` | PricingEngine | Marketplace | Return `effectivePrice` | `module1.test.ts` | **PASS** |
| **14** | `displayProductAndPrice()` | Marketplace | Customer | MarketplaceProductDTO return | `module1.test.ts` | **PASS** |
| **15** | `addItem(Product, quantity)` | Customer | ShoppingCart | `ShoppingCart.addItem` ([ShoppingCart.ts](file:///d:/SE_Project-main/src/domain/ShoppingCart.ts#L42)) | `module2_a.test.ts` | **PASS** |
| **16** | `getCurrentPrice()` | ShoppingCart | Product | `Product.getDetails().currentPrice` | `module2_a.test.ts` | **PASS** |
| **17** | `currentPrice` | Product | ShoppingCart | Return current locked price | `module2_a.test.ts` | **PASS** |
| **18** | `calculateTotal()` | ShoppingCart | ShoppingCart | `ShoppingCart.calculateTotal` ([ShoppingCart.ts](file:///d:/SE_Project-main/src/domain/ShoppingCart.ts#L226)) | `module2_a.test.ts` | **PASS** |
| **19** | `cartUpdated` | ShoppingCart | Customer | Return `{ cartUpdated: true, totalAmount }` | `module2_a.test.ts` | **PASS** |
| **20** | `checkout()` | Customer | CheckoutService | `CheckoutService.checkout` ([CheckoutService.ts](file:///d:/SE_Project-main/src/services/CheckoutService.ts#L75)) | `module2_a.test.ts` | **PASS** |
| **21** | `createOrder()` | ShoppingCart | Order | `tx.order.create` inside atomic transaction | `module2_a.test.ts` | **PASS** |
| **22** | `orderCreated` | Order | CheckoutService | Created `Order` row with `orderNumber` | `module2_a.test.ts` | **PASS** |
| **23** | `reserveStock(quantity)` | Order | InventoryItem | `InventoryItem.reserveStock` ([InventoryItem.ts](file:///d:/SE_Project-main/src/domain/InventoryItem.ts#L71)) | `module2_a.test.ts` | **PASS** |
| **24** | `stockReserved` | InventoryItem | Order | Confirmation and updated `reservedQuantity` | `module2_a.test.ts` | **PASS** |
| **25** | `processPayment(amount)` | Order | Payment | `PaymentService.processPayment` ([PaymentService.ts](file:///d:/SE_Project-main/src/services/PaymentService.ts#L35)) | `module2_a.test.ts` | **PASS** |
| **26** | `authorizePayment(amount)` | Payment | PaymentGateway | Mock gateway authorization call | `module2_a.test.ts` | **PASS** |
| **27** | `paymentSuccessful` | PaymentGateway | Payment | Return `{ success: true, transactionId }` | `module2_a.test.ts` | **PASS** |
| **28** | `paymentConfirmed` | Payment | Order | Payment record created with status `SUCCESSFUL` | `module2_a.test.ts` | **PASS** |
| **29** | `updateStatus("Confirmed")` | Order | Order | Order status transitioned to `CONFIRMED` | `module2_a.test.ts` | **PASS** |
| **30** | `reduceStock(quantity)` | Order | InventoryItem | `InventoryItem.reduceStock` ([InventoryItem.ts](file:///d:/SE_Project-main/src/domain/InventoryItem.ts#L84)) | `module2_a.test.ts` | **PASS** |
| **31** | `inventoryUpdated` | InventoryItem | Order | Quantity decremented, reserved stock cleared | `module2_a.test.ts` | **PASS** |
| **32** | `createDelivery()` | Order | Delivery | `DeliveryService.createDelivery` ([DeliveryService.ts](file:///d:/SE_Project-main/src/services/DeliveryService.ts#L12)) | `e2e_happy_path.test.ts` | **PASS** |
| **33** | `assignDelivery()` | Delivery | DeliveryPartner | Auto-assignment to least-busy partner ([DeliveryService.ts](file:///d:/SE_Project-main/src/services/DeliveryService.ts#L60)) | `e2e_happy_path.test.ts` | **PASS** |
| **34** | `deliveryAccepted` | DeliveryPartner | Delivery | `DeliveryService.acceptDelivery` ([DeliveryService.ts](file:///d:/SE_Project-main/src/services/DeliveryService.ts#L144)) | `e2e_happy_path.test.ts` | **PASS** |
| **35** | `updateStatus("Out for Delivery")` | Delivery | Delivery | `DeliveryService.setOutForDelivery` ([DeliveryService.ts](file:///d:/SE_Project-main/src/services/DeliveryService.ts#L218)) | `e2e_happy_path.test.ts` | **PASS** |
| **36** | `sendNotification()` | Delivery | Notification | `NotificationService.sendNotification` ([NotificationService.ts](file:///d:/SE_Project-main/src/services/NotificationService.ts#L16)) | `e2e_happy_path.test.ts` | **PASS** |
| **37** | `orderOutForDelivery()` | Notification | Customer | Notification row for customer with tracking number | `e2e_happy_path.test.ts` | **PASS** |
| **38** | `updateStatus("Delivered")` | Delivery | Delivery | `DeliveryService.setDelivered` ([DeliveryService.ts](file:///d:/SE_Project-main/src/services/DeliveryService.ts#L323)) | `e2e_happy_path.test.ts` | **PASS** |
| **39** | `sendNotification()` | Delivery | Notification | `NotificationService.sendNotification` ([NotificationService.ts](file:///d:/SE_Project-main/src/services/NotificationService.ts#L16)) | `e2e_happy_path.test.ts` | **PASS** |
| **40** | `deliveryCompleted()` | Delivery | Customer | Final step: Order marked `DELIVERED`, notification emitted | `e2e_happy_path.test.ts` | **PASS** |
| **41** | `paymentFailed` | PaymentGateway | Payment | Simulated failure branch in `PaymentService` | `module2_a.test.ts` | **PASS** |
| **42** | `paymentFailed` | Payment | Order | Failure status propagated to `CheckoutService` | `module2_a.test.ts` | **PASS** |
| **43** | `releaseReservedStock()` | Order | InventoryItem | `InventoryItem.releaseReservedStock` ([InventoryItem.ts](file:///d:/SE_Project-main/src/domain/InventoryItem.ts#L97)) | `module2_a.test.ts` | **PASS** |
| **44** | `stockReleased` | InventoryItem | Order | Confirmation and restored available stock | `module2_a.test.ts` | **PASS** |
| **45** | `paymentFailed()` | Order | Customer | Order marked `CANCELLED`; checkout returns error | `module2_a.test.ts` | **PASS** |
| **46** | `stockUnavailable` | InventoryItem | Product | Availability check fails (`quantity - reserved < req`) | `module2_a.test.ts` | **PASS** |
| **47** | `productUnavailable()` | Product | Customer | Rejection thrown in cart/checkout | `module2_a.test.ts` | **PASS** |
| **48** | `productUnavailable()` | Marketplace | Customer | Customer informed with user-friendly error message | `module2_a.test.ts` | **PASS** |

---

## D. Click-by-Click Evaluator Demonstration

### Step 1: Open Application
Navigate to **`http://localhost:3000`**.  
The top bar features the **Demo Role Switcher** with 4 persona buttons: `Customer`, `Store Owner`, `Delivery Partner`, `Administrator`.

### Step 2: Customer Workflow (Marketplace, Cart, Price Hold, Checkout)
1. Ensure the active role is **Customer** (`Rahul Verma`).
2. Go to **Marketplace** (`/marketplace`).
3. View products with colored expiry badges (`CRITICAL`, `URGENT`, `SOON`, `STANDARD`).
4. Filter by category or search **"milk"**.
5. Click **Show Details** on *Fresh Whole Milk 1L*. Verify original price (₹66), current decay price (₹40), savings (39%), and hours to expiry.
6. Click **Add to Cart** (quantity 2).
7. Add an item from Store 2 (*Organic Paneer 200g*, quantity 1).
8. Go to **Cart** (`/cart`).
9. Notice the **15-Minute Price Hold Countdown**.
10. Click **Proceed to Checkout**. Select **UPI**, enter `rahul@upi`, and click **Pay & Place Order**.
11. Observe: Order is confirmed, split into Store 1 and Store 2 orders.

### Step 3: Store Owner Workflow (Order Management & Pricing Rules)
1. Click **Store Owner** button (`Ramesh Patel`).
2. Go to **Store Orders** (`/store/orders`).
3. Locate the new order for FreshMart.
4. Click **Accept Order**. The status updates to **PREPARING**.
5. Go to **Products & Rules** (`/store`).
6. View FreshMart inventory and custom pricing rules. Note that you cannot edit Store 2's rules.

### Step 4: Delivery Partner Workflow (Assignment & Status Updates)
1. Click **Delivery Partner** button (`Vikram Singh`).
2. You are directed to `/delivery/dashboard`.
3. Locate the assigned delivery for the accepted order.
4. Click **Accept Assignment** (status: `ACCEPTED`).
5. Click **Mark Out for Delivery** (status: `OUT_FOR_DELIVERY`).
6. Click **Confirm Delivery Completed** (status: `DELIVERED`).

### Step 5: Customer Verification of Delivery & Notifications
1. Click **Customer** button (`Rahul Verma`).
2. Click the **Notification Bell** (`/notifications`).
3. View the notifications: "New order confirmed", "Out for delivery", and "Delivered".
4. Go to `/customer/dashboard` and view the order marked as **DELIVERED**.

### Step 6: Administrator Workflow (Time Travel & System Jobs)
1. Click **Administrator** button (`Admin Officer`).
2. Navigate to `/admin/dashboard`.
3. Locate the **Time Travel & Clock Control** widget. Advance the clock by **+6 hours**.
4. Click **Run Dynamic Pricing Job**.
5. Return to **Customer** mode and `/marketplace`: observe that prices have dropped further due to decay.

### Step 7: Live Sequence Diagram Verification
1. Click **Sequence Trace** in the navbar (`/trace`).
2. Select any recent flow (`search-`, `addItem-`, `checkout-`).
3. View the live execution sequence matching messages 1–48 from `Exp4a(1).pdf` with exact timestamps and payloads.

---

## E. Final Defect Report

| Defect ID | Description | Component | Root Cause | Fix Applied | Verification Test |
| :---: |---|---|---|---|---|
| **DEF-01** | Price disparity between marketplace and checkout | `CartService`, `CheckoutService` | Cart and checkout called `calculatePrice` without rule, falling back to 2.5% default | Unified pricing through `PricingEngine.calculateAuthoritativePrice` | `regression_verification.test.ts` (test 4) |
| **DEF-02** | Price floor inversion | `PricingEngine` | `Math.max(rawPrice, floor)` raised items above original price when floor > originalPrice | Enforced `Math.min(originalPrice, Math.max(rawPrice, floor))` | `regression_verification.test.ts` (test 3) |
| **DEF-03** | Product availability leak in details API | `MarketplaceService` | `getProductById` lacked status, expiry, and store verification checks | Added availability filters and auto-transition to `EXPIRED_REMOVED` | `regression_verification.test.ts` (test 5) |
| **DEF-04** | Cart add without availability checks | `CartService` | `addItem` did not check store verification or stock | Enforced store verification, non-expiry, and stock validation | `regression_verification.test.ts` (test 5) |
| **DEF-05** | Concurrent overselling at checkout | `CheckoutService` | Reserved quantity incremented without verifying remaining unreserved stock in tx | Added transactional check `quantity - reservedQuantity >= requested` | `regression_verification.test.ts` (test 7) |
| **DEF-06** | Lack of checkout idempotency | `CheckoutService` | Retrying checkout created duplicate orders and charged mock gateway twice | Added correlation ID lookup returning existing successful order | `regression_verification.test.ts` (test 9) |
| **DEF-07** | Payment refund on failed payment | `StoreOrderService`, `PaymentService` | `rejectOrder` recorded refunds for payments that had never succeeded | Enforced `PaymentService.processRefund` verifying `status === "SUCCESSFUL"` | `regression_verification.test.ts` (test 14) |
| **DEF-08** | Insecure advance-time route | `admin/demo/advance-time` | Checked `if (session && session.role !== "ADMIN")`, allowing unauthenticated callers | Enforced `if (!session || session.role !== "ADMIN")` returning 401 | `regression_verification.test.ts` (test 12) |
| **DEF-09** | Insecure order sweeper & unvalidated input | `store/orders/sweep` | No role check and accepted negative timeout values | Added `STORE_OWNER`/`ADMIN` role check and Zod validation | `regression_verification.test.ts` (test 13) |
| **DEF-10** | Pricing rule IDOR / cross-store edit | `store/pricing-rules` | PUT accepted `ruleId` without validating store ownership | Restricted updates to owned store rules and protected global rules | `regression_verification.test.ts` (test 11) |
| **DEF-11** | Delivery state machine violation | `Delivery` domain | `updateStatus` permitted illegal transitions (e.g. `DELIVERED` → `ACCEPTED`) | Enforced state machine validation throwing `invalidStatusTransition` | `regression_verification.test.ts` (test 14) |
| **DEF-12** | Login redirects blocking evaluator demo | `cart`, `customer/dashboard` | Redirected unauthenticated users to `/login` | Integrated `DEMO_MODE` default persona fallback | Manual browser & subagent |

### Automated Test Execution Results

- **Vitest Test Suite:** `npm test`  
  **Result:** **58 passed (5 test files, 0 failures)**  
  - `tests/regression_verification.test.ts`: 24 passed  
  - `tests/e2e_happy_path.test.ts`: 9 passed  
  - `tests/module2_a.test.ts`: 8 passed  
  - `tests/module1.test.ts`: 10 passed  
  - `tests/domain.test.ts`: 7 passed  
- **TypeScript Typecheck:** `npm run typecheck` (`tsc --noEmit`)  
  **Result:** **Exit Code 0 (Zero errors)**  
- **ESLint Code Quality:** `npm run lint` (`next lint`)  
  **Result:** **Exit Code 0 (✔ No ESLint warnings or errors)**  
- **Next.js Production Build:** `npm run build` (`next build`)  
  **Result:** **Exit Code 0 (All 36 pages and API endpoints compiled and optimized)**  

---

## F. Remaining Known Limitations

1. **Simulated Payment Gateway:** While payment failures (`simulateFailure: true`, card ending `0000`, name with `FAIL`, or UPI with `fail`) exercise real atomic rollback and stock restoration, the gateway is a simulated provider.
2. **Process-Local Virtual Clock:** The demo clock advance affects time inside the running process; in a multi-instance production cluster, an external coordinated time provider or Redis clock would be required.
