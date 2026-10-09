# Traceability Matrix

> Authoritative traceability record for the **Dynamic Expiry-Based Grocery & Zero-Waste Marketplace** SE project.
> Maps every Class-Diagram class, every Sequence-Diagram message (1–48), and every Prisma relationship to implementing code.

---

## 1. Class Diagram to Code (all 17 classes)

| # | Class | Status | Diagram Attributes | Diagram Methods | Domain File | Prisma Model |
|---|-------|--------|--------------------|-----------------|-------------|--------------|
| 1 | **User** | Implemented | `userId`, `name`, `email`, `passwordHash`, `phone` | `login()`, `logout()` | `src/domain/User.ts` | `User` (schema L12-L25) |
| 2 | **Customer** | Implemented | `customerId`, `deliveryAddress` | `register()`, `placeOrder()`, `viewOrderHistory()` | `src/domain/Customer.ts` | `Customer` (L27-L34) |
| 3 | **StoreOwner** | Implemented | `ownerId` | `registerStore()`, `manageProducts()`, `viewAnalytics()` | `src/domain/StoreOwner.ts` | `StoreOwner` (L36-L41) |
| 4 | **DeliveryPartner** | Implemented | `partnerId`, `vehicleNumber` | `acceptDelivery()`, `updateDeliveryStatus()` | `src/domain/DeliveryPartner.ts` | `DeliveryPartner` (L43-L49) |
| 5 | **Administrator** | Implemented | `adminId` | `verifyStore()`, `manageUsers()`, `viewReports()` | `src/domain/Administrator.ts` | `Administrator` (L51-L55) |
| 6 | **Store** | Implemented | `storeId`, `storeName`, `address`, `status` | `addProduct()`, `updateInventory()`, `acceptOrder()`, `viewStoreAnalytics()` | `src/domain/Store.ts` | `Store` (L57-L69) |
| 7 | **Product** | Implemented | `productId`, `name`, `category`, `originalPrice`, `currentPrice`, `expiryDateTime`, `status` | `updatePrice()`, `getDetails()` | `src/domain/Product.ts` | `Product` (L71-L89) |
| 8 | **InventoryItem** | Implemented | `inventoryId`, `quantity`, `reservedQuantity` | `updateQuantity()`, `checkAvailability()` | `src/domain/InventoryItem.ts` | `InventoryItem` (L91-L98) |
| 9 | **PricingRule** | Implemented | `ruleId`, `discountRate`, `expiryThresholdHours`, `maximumDiscount` | `calculateDiscount()` | `src/domain/PricingRule.ts` | `PricingRule` (L100-L111) |
| 10 | **PricingEngine** | Implemented | (stateless service; no stored attributes) | `calculatePrice()`, `applyDecayPricing()`, `updateExpiredProducts()` | `src/domain/PricingEngine.ts` | N/A (engine, not a model) |
| 11 | **ShoppingCart** | Implemented | `cartId`, `totalAmount` | `addItem()`, `removeItem()`, `calculateTotal()` | `src/domain/ShoppingCart.ts` | `ShoppingCart` (L113-L120) |
| 12 | **CartItem** | Implemented | `cartItemId`, `quantity`, `price` | `updateQuantity()` | `src/domain/CartItem.ts` | `CartItem` (L122-L132) |
| 13 | **Order** | Implemented | `orderId`, `orderDate`, `status`, `totalAmount` | `createOrder()`, `confirmOrder()`, `cancelOrder()`, `updateStatus()` | `src/domain/Order.ts` | `Order` (L134-L151) |
| 14 | **OrderItem** | Implemented | `orderItemId`, `quantity`, `unitPrice` | `calculateSubtotal()` | `src/domain/OrderItem.ts` | `OrderItem` (L153-L162) |
| 15 | **Payment** | Implemented | `paymentId`, `amount`, `paymentDate`, `method`, `status` | `processPayment()`, `processRefund()` | `src/domain/Payment.ts` | `Payment` (L164-L174) |
| 16 | **Delivery** | Implemented | `deliveryId`, `deliveryAddress`, `trackingNumber`, `status` | `assignPartner()`, `updateStatus()`, `trackDelivery()` | `src/domain/Delivery.ts` | `Delivery` (L176-L186) |
| 17 | **Notification** | Implemented | `notificationId`, `message`, `type`, `sentAt` | `sendNotification()` | `src/domain/Notification.ts` | `Notification` (L188-L197) |
| — | **WasteAnalytics** | Not in scope | — | — | — | — |
| — | **Review** | Not in scope | — | — | — | — |

---

## 2. Authorized SRS Extensions

All extensions are tagged `// SRS extension` in code and schema. Extra fields are ONLY added where the SRS or relational mapping requires them.

| Target | Extension Field / Table | SRS Reference | Schema Line | Purpose |
|--------|-------------------------|---------------|-------------|---------|
| `PricingRule` | `minimumPriceFloor: Float` | FR-DPE-2, BR-3 | L106 | Prevents price falling below vendor floor |
| `PricingRule` | `category: String?`, `storeId: Int?` | FR-DPE-1 | L107-L109 | Store-specific / category-scoped rules |
| `PriceHistory` | Whole table | FR-DPE-4, A.4 | L202-L209 | Audit log of every price change with reason |
| `CartItem` | `priceHoldExpiresAt: DateTime` | FR-SC-1, BR-7 | L131 | 15-minute per-item price hold |
| `Order` | `storeId: Int`, `orderNumber: String`, `correlationId: String?` | FR-SC-3, FR-OM-2 | L142-L145 | Multi-store routing; human-readable ID; trace link |
| `Payment` | `transactionId: String?` | FR-SP-2, A.4 | L173 | Gateway transaction reference |
| `OrderStatusHistory` | Whole table | Sec 4.10, A.7 | L212-L219 | Full status-change audit trail |
| `TraceLog` | Whole table | Sequence Diagram Contract | L221-L231 | Per-step sequence trace for viva/defense |
| `PlatformConfig` | Whole table | MA-2, FR-AP-2 | L233-L240 | Runtime-editable business-rule thresholds |
| `User` | `role: String` | DEC-02 | L18 | Unified user with role-based profile tables |
| `InventoryItem` | `productId: Int` FK | Relational mapping | L96 | 1-to-1 product ownership |
| `Notification` | `isRead: Boolean` | UX requirement | L193 | Read/unread state |
| `ShoppingCart` | `customerId` FK | Relational mapping | L117 | 1-to-1 customer ownership |

---

## 3. Sequence Diagram to Code (all 48 messages)

| Step | Diagram Message Label | From -> To | Implementing Function | Test Asserting It |
|------|-----------------------|------------|-----------------------|-------------------|
| 1 | `searchProduct(productName)` | Customer -> Marketplace | `MarketplaceService.searchProduct()` (MarketplaceService.ts L66) | `module1.test.ts` - step 1 trace logged |
| 2 | `getProductDetails()` | Marketplace -> Product | `Product.getDetails()` (Product.ts) | `module1.test.ts` - productDetails returned |
| 3 | `productDetails` | Product -> Marketplace | Return value from `getDetails()` | `module1.test.ts` - name/price in DTO |
| 4 | `checkAvailability()` | Product -> InventoryItem | `InventoryItem.checkAvailability()` (InventoryItem.ts L37) | `domain.test.ts` - InventoryItem suite |
| 5 | `stockStatus` | InventoryItem -> Product | Return `{ available, stockStatus, isAvailable }` | `domain.test.ts` - stockStatus field |
| 6 | `calculateCurrentPrice(Product)` | Marketplace -> PricingEngine | `PricingEngine.calculatePriceWithTrace()` (PricingEngine.ts L20) | `module1.test.ts` - price computed |
| 7 | `getExpiryDetails()` | PricingEngine -> Product | `Product.getExpiryDetails()` (Product.ts) | `module1.test.ts` - step 7 in trace |
| 8 | `expiryDateTime` | Product -> PricingEngine | Return `expiryDateTime` | `module1.test.ts` - step 8 in trace |
| 9 | `calculateDiscount(expiryTime)` | PricingEngine -> PricingRule | `PricingRule.calculateDiscount()` (PricingRule.ts L41) | `domain.test.ts` - discount formula |
| 10 | `discountRate` | PricingRule -> PricingEngine | Return discount fraction (0.0-0.80) | `domain.test.ts` - discount value |
| 11 | `updatePrice(discountedPrice)` | PricingEngine -> Product | `Product.updatePrice()` (Product.ts) | `module1.test.ts` - step 11 in trace |
| 12 | `priceUpdated` | Product -> PricingEngine | Ack from `updatePrice()` | `module1.test.ts` - step 12 in trace |
| 13 | `currentPrice` | PricingEngine -> Marketplace | Return `product.currentPrice` | `module1.test.ts` - step 13 in trace |
| 14 | `displayProductAndPrice()` | Marketplace -> Customer | Return DTO from `searchProduct()` | `module1.test.ts` - step 14 in trace |
| 15 | `addItem(Product, quantity)` | Customer -> ShoppingCart | `ShoppingCart.addItem()` (ShoppingCart.ts L42) | `module2_a.test.ts` - "adds item ... steps 15-19" |
| 16 | `getCurrentPrice()` | ShoppingCart -> Product | Price retrieved inside `addItem()` | `module2_a.test.ts` - step 16 in trace |
| 17 | `currentPrice` | Product -> ShoppingCart | `product.getDetails().currentPrice` | `module2_a.test.ts` - step 17 in trace |
| 18 | `calculateTotal()` | ShoppingCart -> ShoppingCart | `ShoppingCart.calculateTotal()` (L226) | `module2_a.test.ts` - totalAmount correct |
| 19 | `cartUpdated` | ShoppingCart -> Customer | Return `{ cartUpdated: true }` | `module2_a.test.ts` - cartUpdated: true |
| 20 | `checkout()` | Customer -> CheckoutService | `CheckoutService.checkout()` (CheckoutService.ts L75) | `module2_a.test.ts` - "full checkout happy path" |
| 21 | `createOrder()` | ShoppingCart -> Order | `Order.createOrder()` inside `checkout()` | `module2_a.test.ts` - order created in DB |
| 22 | `orderCreated` | Order -> CheckoutService | DB row returned from Prisma | `module2_a.test.ts` - orderId present |
| 23 | `reserveStock(quantity)` | Order -> InventoryItem | `InventoryItem.reserveStock()` (InventoryItem.ts L71) | `module2_a.test.ts` - step 23 in trace |
| 24 | `stockReserved` | InventoryItem -> Order | Return from `reserveStock()` | `module2_a.test.ts` - step 24 in trace |
| 25 | `processPayment(amount)` | Order -> Payment | `PaymentService.processPayment()` (PaymentService.ts L35) | `module2_a.test.ts` - step 25 in trace |
| 26 | `authorizePayment(amount)` | Payment -> PaymentGateway | Internal mock gateway call in `PaymentService` | `module2_a.test.ts` - step 26 in trace |
| 27 | `paymentSuccessful` | PaymentGateway -> Payment | Gateway returns `{ success: true }` | `module2_a.test.ts` - step 27 in trace |
| 28 | `paymentConfirmed` | Payment -> Order | `transactionId` stored on Payment row | `module2_a.test.ts` - step 28 in trace |
| 29 | `updateStatus("Confirmed")` | Order -> Order | `Order.updateStatus("CONFIRMED")` in `checkout()` | `module2_a.test.ts` - order status CONFIRMED |
| 30 | `reduceStock(quantity)` | Order -> InventoryItem | `InventoryItem.reduceStock()` (InventoryItem.ts L84) | `module2_a.test.ts` - step 30 in trace |
| 31 | `inventoryUpdated` | InventoryItem -> Order | Return from `reduceStock()` | `module2_a.test.ts` - step 31 in trace |
| 32 | `createDelivery()` | Order/Service -> Delivery | `DeliveryService.createDelivery()` (DeliveryService.ts L12) | `e2e_happy_path.test.ts` - step 32 in trace |
| 33 | `assignDelivery()` | Delivery -> DeliveryPartner | `DeliveryService.assignDelivery()` + `Delivery.assignPartner()` (DeliveryService.ts L60, Delivery.ts L36) | `e2e_happy_path.test.ts` - step 33 in trace |
| 34 | `deliveryAccepted` | DeliveryPartner -> Delivery | `DeliveryService.acceptDelivery()` (DeliveryService.ts L144) | `e2e_happy_path.test.ts` - status ACCEPTED |
| 35 | `updateStatus("Out for Delivery")` | Delivery -> Delivery | `DeliveryService.setOutForDelivery()` + `Delivery.updateStatus()` (DeliveryService.ts L218) | `e2e_happy_path.test.ts` - step 35 in trace |
| 36 | `sendNotification()` | Delivery -> Notification | `NotificationService.sendNotification()` (NotificationService.ts L16) | `e2e_happy_path.test.ts` - step 36 in trace |
| 37 | `orderOutForDelivery()` | Notification -> Customer | Notification row created for customer | `e2e_happy_path.test.ts` - step 37 in trace |
| 38 | `updateStatus("Delivered")` | Delivery -> Delivery | `DeliveryService.setDelivered()` + `Delivery.updateStatus()` (DeliveryService.ts L323) | `e2e_happy_path.test.ts` - status DELIVERED |
| 39 | `sendNotification()` | Delivery -> Notification | `NotificationService.sendNotification()` | `e2e_happy_path.test.ts` - step 39 in trace |
| 40 | `deliveryCompleted()` | Delivery -> Customer | Step 40 trace + order status DELIVERED | `e2e_happy_path.test.ts` - step 40 in trace |
| 41 | `paymentFailed` | PaymentGateway -> Payment | `PaymentService` returns `{ success: false }` (card ending 0000 triggers it) | `module2_a.test.ts` - "payment failure branch" |
| 42 | `paymentFailed` | Payment -> Order | Failure propagated through `CheckoutService` | `module2_a.test.ts` - step 42 in trace |
| 43 | `releaseReservedStock()` | Order -> InventoryItem | `InventoryItem.releaseReservedStock()` (InventoryItem.ts L97) | `module2_a.test.ts` - step 43 in trace |
| 44 | `stockReleased` | InventoryItem -> Order | Return from `releaseReservedStock()` | `module2_a.test.ts` - step 44 in trace |
| 45 | `paymentFailed()` | Order -> Customer | `CheckoutService.checkout()` returns `{ success: false, error }` | `module2_a.test.ts` - success: false |
| 46 | `stockUnavailable` | InventoryItem -> Product | `InventoryItem.checkAvailability()` returns `isAvailable: false` | `module2_a.test.ts` - "validates inventory ... stockUnavailable" |
| 47 | `productUnavailable()` | Product/Order -> Customer | `ShoppingCart.addItem()` throws; trace step 47 logged | `module2_a.test.ts` - step 47 in trace |
| 48 | `productUnavailable()` | Marketplace -> Customer | Trace step 48; error returned to caller | `module2_a.test.ts` - step 48 in trace |

---

## 4. Diagram Relationships and Multiplicities to Prisma Schema

| Diagram Relationship | Multiplicity | Prisma Implementation | Schema Lines |
|---------------------|--------------|-----------------------|--------------|
| User to Customer | 1 to 0..1 | `Customer.customerId` FK to `User.userId`; `@id` | L29-L31 |
| User to StoreOwner | 1 to 0..1 | `StoreOwner.ownerId` FK to `User.userId`; `@id` | L37-L39 |
| User to DeliveryPartner | 1 to 0..1 | `DeliveryPartner.partnerId` FK; `@id` | L44-L47 |
| User to Administrator | 1 to 0..1 | `Administrator.adminId` FK; `@id` | L51-L54 |
| StoreOwner to Store | 1 to 0..* | `Store.ownerId` FK; `stores[]` on StoreOwner | L62-L64 |
| Store to Product | 1 to 0..* | `Product.storeId` FK; `products[]` on Store | L80-L81 |
| Product to InventoryItem | 1 to 1 | `InventoryItem.productId` FK `@unique` | L96-L97 |
| PricingRule to Product | 1 to 0..* | `Product.pricingRuleId` FK nullable | L82-L83 |
| Store to PricingRule | 1 to 0..* | `PricingRule.storeId` FK nullable (SRS ext) | L108-L109 |
| Customer to ShoppingCart | 1 to 1 | `ShoppingCart.customerId` FK `@unique` | L117-L118 |
| ShoppingCart to CartItem | 1 to 0..* | `CartItem.cartId` FK; `items[]` on ShoppingCart | L127-L128 |
| CartItem to Product | 0..* to 1 | `CartItem.productId` FK | L129-L130 |
| Customer to Order | 1 to 0..* | `Order.customerId` FK; `orders[]` on Customer | L140-L141 |
| Store to Order | 1 to 0..* | `Order.storeId` FK (SRS ext); `orders[]` on Store | L142-L143 |
| Order to OrderItem | 1 to 1..* | `OrderItem.orderId` FK; `items[]` on Order | L158-L159 |
| OrderItem to Product | 0..* to 1 | `OrderItem.productId` FK | L160-L161 |
| Order to Payment | 1 to 1 | `Payment.orderId` FK `@unique` | L171-L172 |
| Order to Delivery | 1 to 0..1 | `Delivery.orderId` FK `@unique` | L182-L183 |
| DeliveryPartner to Delivery | 1 to 0..* | `Delivery.partnerId` FK nullable | L184-L185 |
| User to Notification | 1 to 0..* | `Notification.userId` FK | L195-L196 |
| Product to PriceHistory | 1 to 0..* | `PriceHistory.productId` FK (SRS ext) | L204-L205 |
| Order to OrderStatusHistory | 1 to 0..* | `OrderStatusHistory.orderId` FK (SRS ext) | L214-L215 |
