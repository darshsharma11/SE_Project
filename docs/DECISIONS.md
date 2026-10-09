# Architectural Decisions and Diagram/SRS Conflict Log

> Per the project specification: **if the diagram and SRS disagree, the DIAGRAM wins.**
> Every deviation is recorded here with the step/class affected and the choice made.

---

## 1. Conflict Resolution Log (Diagram vs SRS)

| ID | Conflict / Ambiguity | Diagram says | SRS says | Decision and Rationale |
|----|----------------------|--------------|----------|------------------------|
| DEC-01 | **Primary key types** | `userId: int`, `productId: int`, etc. (integer IDs) | Relational-style `user_id` columns | **Diagram wins.** All entities use auto-increment integer IDs in Prisma. Column names match the diagram attribute names exactly (camelCase). |
| DEC-02 | **User subtyping / roles** | User is a generalization of Customer, StoreOwner, DeliveryPartner, Administrator (four separate classes) | Suggests a single `User` table with a role column | **Diagram wins; SRS accommodated.** One `User` model with a `role` enum (SRS extension) plus 1-to-1 profile tables (`Customer`, `StoreOwner`, `DeliveryPartner`, `Administrator`) that share the same primary key as their parent User. This preserves all four class-diagram classes and all their attributes. |
| DEC-03 | **Order status after payment** | Diagram shows `updateStatus("Confirmed")` at step 29, immediately after `paymentConfirmed` (step 28). No intermediate PLACED-then-payment-then-CONFIRMED split is drawn. | SRS mentions PLACED, CONFIRMED, PREPARING as separate stages, some versions imply PLACED is the state while waiting for payment | **Diagram wins.** Orders begin life in PLACED status (at `createOrder()`), move to CONFIRMED immediately upon payment success (step 29), and then to PREPARING when the store accepts. This matches the sequence arrow at step 29 exactly. |
| DEC-04 | **Delivery created before store accepts** | Step 32 `createDelivery()` appears right after step 31 `inventoryUpdated`, which is before store action (acceptOrder). Step 33 `assignDelivery()` follows immediately in the diagram. | SRS Section 4 implies delivery should be set up after the store confirms preparation. | **Diagram wins.** `DeliveryService.createDelivery()` is called inside `CheckoutService.checkout()` immediately after payment confirmation and stock reduction (step 31). The delivery record is created in PENDING status; the partner is auto-assigned but must physically accept only after the store accepts and transitions to PREPARING (guarded in `setOutForDelivery()`). |
| DEC-05 | **Pricing formula** | Diagram names `calculateDiscount(expiryTime)` in PricingRule but does not specify the formula | SRS FR-DPE-2 describes decay based on hours in window | **SRS formula, diagram method name.** Formula: `discount% = min(discountRate x hoursElapsedInWindow, maximumDiscount, 80%)`. Price = `max(originalPrice x (1 - discount%), minimumPriceFloor)`, rounded to whole rupees. Implemented in `PricingRule.calculateDiscount()` and `PricingEngine.calculatePrice()`. |
| DEC-06 | **Failed payment behaviour / RESERVED rule** | Steps 41-44: on payment failure, `releaseReservedStock()` is called. Diagram does not specify Product.status change. | SRS FR-INV-3 says product goes back to ACTIVE; also states RESERVED status when all units are reserved. | **Diagram + SRS combined.** On payment failure: (a) `releaseReservedStock()` decrements `reservedQuantity` (step 43); (b) product reverts to ACTIVE if any units are now available; RESERVED only if all units are still reserved by other carts. This satisfies both the sequence diagram cleanup steps and the SRS inventory rules. |
| DEC-07 | **Multi-store cart** | Diagram shows a single ShoppingCart per customer. No explicit multi-store discussion. | SRS Section 4.6 says "Cart partitioned per store at checkout" | **SRS used as extension.** Cart can hold items from multiple stores. At `checkout()`, CheckoutService partitions items by `storeId` and creates one `Order` per store, all under the same payment transaction. `Order.storeId` and `Order.orderNumber` are SRS extensions documented in TRACEABILITY.md. |
| DEC-08 | **Stock reservation scope** | Step 23 `reserveStock(quantity)` is called per order (i.e. after per-store order creation). Step 30 `reduceStock` after payment. | SRS: reserve at cart-add time, reduce on confirmation. | **Diagram wins.** Stock is reserved at order creation time (step 23), not at cart-add time. Cart items hold only a price lock (`priceHoldExpiresAt`). This matches the sequence arrows: step 23 is inside the checkout flow, not the addItem flow. |
| DEC-09 | **15-minute store response timeout** | Not shown in the sequence diagram. | SRS BR-6: store must accept/reject within 15 minutes; auto-cancel + refund if not. | **SRS extension.** `StoreOrderService.sweepUnrespondedOrders()` is a sweeper called via `POST /api/v1/store/orders/sweep`. It auto-cancels CONFIRMED orders older than 15 minutes and triggers `processRefund()` + stock restoration. Exposed as a manual-trigger endpoint (can be scheduled). |
| DEC-10 | **Raw card data** | Diagram shows `processPayment(amount)` — no mention of card fields. | SRS states "never store raw card data" (PCI). | **SRS hard rule enforced.** `PaymentService` accepts `cardDetails` (last 4 digits used for failure simulation only, full number never persisted). The `Payment` Prisma model stores only `transactionId` (a generated reference). No card number, CVV, or expiry date is stored anywhere. |
| DEC-11 | **Single source of "now"** | Diagram does not specify; only the PROJECT_CONTEXT hard rule covers it. | PROJECT_CONTEXT: all `now` reads go through `src/lib/clock.ts`. | **Hard rule enforced.** Every `clock.now()` call goes through `src/lib/clock.ts`. The clock supports `setFixed()` and `advance()` methods for demo/testing. No direct `new Date()` calls in domain or service code. |
| DEC-12 | **Notification model** | Diagram: `Notification` has `notificationId, message, type, sentAt`, method `sendNotification()`. No read/unread concept. | UX requirement for a functional notification centre. | **SRS extension.** `isRead: Boolean` added to Notification (tagged in schema). The `sendNotification()` method on the domain class dispatches; persistence is handled by `NotificationService`. |
| DEC-13 | **WasteAnalytics and Review** | Both classes appear in the full class diagram. | SRS covers them in Sections 4.11 and 4.12. | **Out of scope.** PROJECT_CONTEXT explicitly excludes them from Modules 1 and 2. No code, routes, or DB tables for these classes exist. |

---

## 2. Technical Stack Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 14 App Router + TypeScript strict mode | Single-repo full-stack, server components + API routes, zero extra backend server |
| Database / ORM | SQLite via Prisma | One-command setup, no Docker, portable to PostgreSQL with one config line change |
| Authentication | bcryptjs + JWT in `httpOnly` cookie | Stateless; no session store; role embedded in token; secure against XSS |
| Time management | `src/lib/clock.ts` singleton | Centralised, controllable in tests and demo (advance by hours to trigger decay) |
| Sequence tracing | `TraceLog` SQLite table + `/trace` page | Every step 1-48 recorded per `correlationId`; viewable in viva |
| Payment simulation | `PaymentService` mock gateway | Card ending `0000` or UPI ID containing `fail` triggers step 41-45 branch |
| Business rule constants | `src/lib/config.ts` + `PlatformConfig` DB table | Constants in code; overridable at runtime via admin panel |
| Testing | Vitest with `@prisma/client` against real SQLite test DB | True integration tests; no mocking of DB layer |
