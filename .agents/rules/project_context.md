=============== PROJECT CONTEXT (save verbatim to docs/PROJECT_CONTEXT.md) ===============

ASSIGNMENT
Implement 2 core modules of the case study, as per the CLASS DIAGRAM and the SEQUENCE DIAGRAM, as a fully
functional web application (real database, real logic, working screens; no mock data in the UI).
Module 1: Product, Expiry & Dynamic Pricing (sequence steps 1-14).
Module 2: Cart, Order, Payment & Delivery (sequence steps 15-48 including failure branches).
Out of scope: analytics dashboards, reviews, WasteAnalytics, real payment/SMS/email/maps, loyalty, subscriptions,
multi-currency. If the diagram and SRS disagree, the DIAGRAM wins; log each such decision in docs/DECISIONS.md.

TECH STACK
Next.js (App Router) + TypeScript strict, single full-stack app. Prisma + SQLite (portable to PostgreSQL).
Zod validation, bcryptjs, JWT in httpOnly cookie, Tailwind CSS with a simple clean UI (function over looks),
Vitest. One-command setup: `npm install && npm run db:reset && npm run dev` (db:reset = migrate + seed).
No external services, API keys or Docker.

ARCHITECTURE (how the code mirrors the diagrams)
src/domain/        one class per diagram class; same attribute names, same method names as the class diagram;
                   business rules and status-transition guards live here.
src/repositories/  Prisma persistence (domain object <-> DB row).
src/services/      MarketplaceService (the "Marketplace" lifeline), CheckoutService, DeliveryService, and a mock
                   PaymentGateway class. They orchestrate domain classes in the order of the sequence diagram.
src/app/api/v1/    thin REST routes: validate (Zod) -> check role/ownership -> call a service. No business logic.
src/app/           pages; they call the API only. The UI never calculates prices or changes stock.
src/lib/           trace.ts (SequenceTracer), clock.ts (single source of "now" with a demo offset), config.ts.
docs/              diagrams, PROJECT_CONTEXT.md, DECISIONS.md, TRACEABILITY.md, DEMO_SCRIPT.md.

CLASS DIAGRAM CONTRACT (use exactly these names)
User: userId, name, email, passwordHash, phone; login(), logout()
Customer: customerId, deliveryAddress; register(), placeOrder(), viewOrderHistory()
StoreOwner: ownerId; registerStore(), manageProducts(), viewAnalytics()
DeliveryPartner: partnerId, vehicleNumber; acceptDelivery(), updateDeliveryStatus()
Administrator: adminId; verifyStore(), manageUsers(), viewReports()
Store: storeId, storeName, address, status; addProduct(), updateInventory(), acceptOrder(), viewStoreAnalytics()
Product: productId, name, category, originalPrice, currentPrice, expiryDateTime, status; updatePrice(), getDetails()
InventoryItem: inventoryId, quantity, reservedQuantity; updateQuantity(), checkAvailability()
PricingRule: ruleId, discountRate, expiryThresholdHours, maximumDiscount; calculateDiscount()
PricingEngine: calculatePrice(product), updateExpiredProducts(), applyDecayPricing()
ShoppingCart: cartId, totalAmount; addItem(), removeItem(), calculateTotal()
CartItem: cartItemId, quantity, price; updateQuantity()
Order: orderId, orderDate, status, totalAmount; createOrder(), confirmOrder(), cancelOrder(), updateStatus()
OrderItem: orderItemId, quantity, unitPrice; calculateSubtotal()
Payment: paymentId, amount, paymentDate, method, status; processPayment(), processRefund()
Delivery: deliveryId, deliveryAddress, trackingNumber, status; assignPartner(), updateStatus(), trackDelivery()
Notification: notificationId, message, type, sentAt; sendNotification()
Reproduce the diagram's relationships and multiplicities in the Prisma schema. Extra attributes/tables are allowed ONLY
when the SRS needs them (PricingRule.minimumPriceFloor, PriceHistory, CartItem.priceHoldExpiresAt, Order.storeId and
order number, Payment.transactionId, OrderStatusHistory, TraceLog, PlatformConfig). Mark each with the comment
"SRS extension" and list them in docs/TRACEABILITY.md. Never rename or drop a diagram attribute or method.

SEQUENCE DIAGRAM CONTRACT (message labels in order; verify arrows against the PDF, the PDF wins)
 1 searchProduct(productName)            Customer -> Marketplace
 2 getProductDetails()                   Marketplace -> Product
 3 productDetails
 4 checkAvailability()                   Product -> InventoryItem
 5 stockStatus
 6 calculateCurrentPrice(Product)        -> PricingEngine
 7 getExpiryDetails()                    PricingEngine -> Product
 8 expiryDateTime
 9 calculateDiscount(expiryTime)         PricingEngine -> PricingRule
10 discountRate
11 updatePrice(discountedPrice)          PricingEngine -> Product
12 priceUpdated
13 currentPrice
14 displayProductAndPrice()
15 addItem(Product, quantity)            Customer -> ShoppingCart
16 getCurrentPrice()                     ShoppingCart -> Product
17 currentPrice
18 calculateTotal()
19 cartUpdated
20 checkout()
21 createOrder()                         ShoppingCart -> Order
22 orderCreated
23 reserveStock(quantity)                Order -> InventoryItem
24 stockReserved
25 processPayment(amount)                Order -> Payment
26 authorizePayment(amount)              Payment -> PaymentGateway
27 paymentSuccessful
28 paymentConfirmed
29 updateStatus("Confirmed")             Order
30 reduceStock(quantity)                 -> InventoryItem
31 inventoryUpdated
32 createDelivery()
33 assignDelivery()                      Delivery -> DeliveryPartner
34 deliveryAccepted
35 updateStatus("Out for Delivery")
36 sendNotification()                    -> Notification
37 orderOutForDelivery()
38 updateStatus("Delivered")
39 sendNotification()
40 deliveryCompleted()
Failure branches:
41/42 paymentFailed (gateway -> Payment -> Order)
43 releaseReservedStock()                Order -> InventoryItem
44 stockReleased
45 paymentFailed()                       reported to customer
46 stockUnavailable                      InventoryItem reports not enough stock
47/48 productUnavailable()               reported to customer
Every method that implements a message MUST call trace.step(n, label, from, to) with a shared correlationId.
The /trace page lists these per flow so a flow can be shown step by step in the viva.

BUSINESS RULES (constants in src/lib/config.ts, editable in PlatformConfig)
- Expiry bands (derived, not stored): CRITICAL 0-6h, URGENT 6-24h, SOON 1-3 days, STANDARD 3+ days.
- Pricing (implementation choice, lives only in PricingEngine/PricingRule): decay starts when hoursRemaining <=
  expiryThresholdHours; discount% = min(discountRate x hoursElapsedInWindow, maximumDiscount, 80); price =
  max(originalPrice x (1 - discount%), minimumPriceFloor); rounded to whole rupees.
- Prices recalculated hourly (applyDecayPricing) and immediately when a store edits price/quantity/rule.
  Every price change writes a PriceHistory row.
- Expired products (expiryDateTime <= now) are removed automatically (updateExpiredProducts) and can never be bought.
  Creating a product with expiry <= now is rejected.
- Search returns only ACTIVE, in-stock, non-expired products.
- Product.status: DRAFT, ACTIVE, RESERVED, SOLD, EXPIRED_REMOVED, MANUALLY_REMOVED. RESERVED when no available units remain
  but some are reserved; back to ACTIVE if released; SOLD when quantity hits 0 after reduceStock. Illegal transitions throw.
- Store must be VERIFIED to add products.
- Cart price hold: 15 minutes per item (priceHoldExpiresAt). After expiry the price refreshes to the engine's current price and
  the customer must confirm before checkout.
- Order.status: PLACED, CONFIRMED, PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED. Customer may cancel only in PLACED or
  CONFIRMED. One order per store at checkout. Store must accept/reject within 15 minutes (auto-cancel + refund).
- Currency INR (₹). Timezone IST. Payment methods UPI / CARD / WALLET via a mock gateway; never store raw card data.

HARD RULES
- Prices are computed only by PricingEngine on the server. Stock changes only via InventoryItem methods.
- Every status shown in the UI comes from the database. All "now" reads go through src/lib/clock.ts.
- Zod validation on every input; role checks (CUSTOMER, STORE_OWNER, DELIVERY_PARTNER, ADMIN) and ownership checks on
  every API route (a customer sees only their own cart/orders, a store owner only their own store, a partner only their deliveries).
- Multi-step DB changes run inside a transaction so stock can never be left reserved by a crash.
- No features outside the two modules.

WORKING STYLE
Inspect the repo before changing it. Make a short plan first. After each task: typecheck, lint, tests, start the app, click
through the feature in the browser, fix problems, then summarise what works and what does not. Never leave the app broken. Never
rewrite working code; extend it.
=============== END PROJECT CONTEXT ===============
