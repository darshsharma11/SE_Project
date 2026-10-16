# Dynamic Expiry-Based Grocery & Zero-Waste Marketplace

> **SE University Project** — Module 1 (Product, Expiry & Dynamic Pricing) + Module 2 (Cart, Order, Payment & Delivery)
>
> A fully functional web application where partner grocery stores list near-expiry food, an hourly decay engine lowers prices as expiry approaches, and customers shop, pay, and receive deliveries.

---

## Quick Start (one command)

```bash
npm install && npm run db:reset && npm run dev
```

Then open **http://localhost:3000**.

> **Requirements:** Node.js >= 18, npm >= 9. No Docker, no external services, no API keys.

---

## Prerequisites

| Tool | Minimum Version | Purpose |
|------|-----------------|---------|
| Node.js | 18.x | Runtime |
| npm | 9.x | Package manager |
| SQLite | Built in (via Prisma) | Database |

---

## All Available Scripts

```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run start        # Start production server (after build)
npm run lint         # ESLint
npm run typecheck    # TypeScript strict check (tsc --noEmit)
npm run test         # Run all Vitest tests
npm run db:migrate   # Prisma migrate dev (schema changes)
npm run db:seed      # Re-run seed (idempotent, clears all data first)
npm run db:reset     # migrate + seed in one command (use for fresh start)
```

---

## Demo Accounts (password: `Password123!` for all)

| Role | Name | Email |
|------|------|-------|
| Admin | Admin Officer | admin@zerowaste.org |
| Store Owner 1 | Ramesh Patel (FreshMart) | freshmart.owner@gmail.com |
| Store Owner 2 | Priya Sharma (GreenLeaf) | greenleaf.owner@gmail.com |
| Delivery Partner 1 | Vikram Singh | partner1@zerowaste.org |
| Delivery Partner 2 | Amit Kumar | partner2@zerowaste.org |
| Customer 1 | Rahul Verma | rahul.customer@gmail.com |
| Customer 2 | Sneha Kulkarni | sneha.customer@gmail.com |
| Customer 3 | Arjun Mehta | arjun.customer@gmail.com |

---

## How to Run Tests

```bash
# Run all tests (domain unit tests + integration tests)
npm run test

# Run in watch mode
npx vitest

# Run a specific test file
npx vitest tests/domain.test.ts
npx vitest tests/module1.test.ts
npx vitest tests/module2_a.test.ts
npx vitest tests/e2e_happy_path.test.ts
```

> Tests run against a real SQLite database (the same DATABASE_URL from `.env`). Each test suite manages its own data with unique IDs to avoid collisions.

---

## Folder Structure

```
SE_PROJECT/
├── docs/
│   ├── PROJECT_CONTEXT.md     # Authoritative project spec (read first)
│   ├── TRACEABILITY.md        # Class diagram -> code, sequence -> code, schema -> Prisma
│   ├── DECISIONS.md           # Diagram/SRS conflicts and architectural choices
│   ├── DEMO_SCRIPT.md         # Click-by-click viva demo script
│   └── *.pdf                  # Original class/sequence/activity/SRS diagrams
│
├── prisma/
│   ├── schema.prisma          # All 17 diagram classes + SRS extension tables
│   └── seed.ts                # Idempotent seed (demo accounts, stores, products, rules)
│
├── src/
│   ├── domain/                # One class per diagram class; exact attribute and method names
│   │   ├── User.ts            # login(), logout()
│   │   ├── Customer.ts        # register(), placeOrder(), viewOrderHistory()
│   │   ├── StoreOwner.ts      # registerStore(), manageProducts(), viewAnalytics()
│   │   ├── DeliveryPartner.ts # acceptDelivery(), updateDeliveryStatus()
│   │   ├── Administrator.ts   # verifyStore(), manageUsers(), viewReports()
│   │   ├── Store.ts           # addProduct(), updateInventory(), acceptOrder()
│   │   ├── Product.ts         # updatePrice(), getDetails(), getExpiryDetails()
│   │   ├── InventoryItem.ts   # checkAvailability(), updateQuantity(), reserveStock(), reduceStock(), releaseReservedStock()
│   │   ├── PricingRule.ts     # calculateDiscount(expiryTime)
│   │   ├── PricingEngine.ts   # calculatePrice(), applyDecayPricing(), updateExpiredProducts()
│   │   ├── ShoppingCart.ts    # addItem(), removeItem(), calculateTotal()
│   │   ├── CartItem.ts        # updateQuantity()
│   │   ├── Order.ts           # createOrder(), confirmOrder(), cancelOrder(), updateStatus()
│   │   ├── OrderItem.ts       # calculateSubtotal()
│   │   ├── Payment.ts         # processPayment(), processRefund()
│   │   ├── Delivery.ts        # assignPartner(), updateStatus(), trackDelivery()
│   │   └── Notification.ts    # sendNotification()
│   │
│   ├── repositories/          # Prisma persistence (domain object <-> DB row)
│   │   ├── ProductRepository.ts
│   │   └── PricingRuleRepository.ts
│   │
│   ├── services/              # Orchestrate domain classes per sequence diagram order
│   │   ├── MarketplaceService.ts   # Steps 1-14
│   │   ├── CartService.ts          # Steps 15-19 (persistence layer for ShoppingCart)
│   │   ├── CheckoutService.ts      # Steps 20-31, 41-48
│   │   ├── PaymentService.ts       # Steps 25-28, 41-42 (mock PaymentGateway inside)
│   │   ├── DeliveryService.ts      # Steps 32-40
│   │   ├── StoreOrderService.ts    # Store accept/reject + 15-min sweeper
│   │   └── NotificationService.ts  # Steps 36, 39 (sendNotification)
│   │
│   ├── app/
│   │   ├── api/v1/            # Thin REST routes: validate (Zod) -> role check -> call service
│   │   │   ├── auth/          # login, logout, register, /me
│   │   │   ├── marketplace/   # GET /search
│   │   │   ├── cart/          # GET, POST, DELETE, PATCH
│   │   │   ├── checkout/      # POST
│   │   │   ├── orders/        # GET, GET /[id]/track
│   │   │   ├── store/         # products CRUD, pricing-rules, /orders
│   │   │   ├── delivery/      # [id]/accept, /decline, /out-for-delivery, /delivered
│   │   │   ├── notifications/ # GET, PATCH, PATCH /[id]
│   │   │   ├── pricing/       # apply-decay, update-expired
│   │   │   ├── admin/         # verify-store, clock, platform-config
│   │   │   └── trace/         # GET trace logs per correlationId
│   │   │
│   │   ├── marketplace/       # Product listing with expiry bands and pricing
│   │   ├── cart/              # Cart with price-hold countdown timers
│   │   ├── customer/dashboard/# Order history + Track Order links
│   │   ├── orders/[id]/       # Real-time delivery tracking timeline
│   │   ├── store/             # Store portal: products, pricing rules
│   │   ├── store/orders/      # Store order management with 15-min countdown
│   │   ├── delivery/dashboard/# Delivery partner: accept, pickup, deliver
│   │   ├── notifications/     # Notification centre with unread count
│   │   └── admin/             # Admin: verify store, clock control, config
│   │
│   ├── lib/
│   │   ├── clock.ts           # Single source of "now"; supports setFixed() / advance()
│   │   ├── trace.ts           # SequenceTracer: trace.step() writes to TraceLog
│   │   ├── config.ts          # Business rule constants (BR_CART_HOLD_MINUTES etc.)
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── auth.ts            # JWT helpers
│   │   └── events.ts          # In-process event bus (order events)
│   │
│   └── components/
│       ├── Navbar.tsx          # Role-aware nav with notification bell + unread count
│       └── ClockWidget.tsx     # Shows virtual clock time on store/admin pages
│
└── tests/
    ├── domain.test.ts          # Pure domain class unit tests (no DB)
    ├── module1.test.ts         # Integration: search, pricing, trace steps 1-14
    ├── module2_a.test.ts       # Integration: cart, checkout, payment, steps 15-31, 41-48
    └── e2e_happy_path.test.ts  # End-to-end: full steps 20-40 + payment failure
```

---

## Module to Diagram Mapping

| Module | Sequence Steps | Services | Domain Classes | UI Pages |
|--------|---------------|----------|----------------|----------|
| **Module 1**: Product, Expiry & Dynamic Pricing | Steps 1-14 | `MarketplaceService`, `PricingEngine`, `PricingRule` | `Product`, `InventoryItem`, `PricingRule`, `PricingEngine`, `Store` | `/marketplace`, `/store`, `/admin` |
| **Module 2A**: Cart, Order, Payment | Steps 15-31, 41-48 | `CartService`, `CheckoutService`, `PaymentService` | `ShoppingCart`, `CartItem`, `Order`, `OrderItem`, `Payment`, `InventoryItem` | `/cart`, `/customer/dashboard`, `/checkout` |
| **Module 2B**: Delivery | Steps 32-40 | `DeliveryService`, `StoreOrderService`, `NotificationService` | `Delivery`, `DeliveryPartner`, `Notification`, `Order` | `/store/orders`, `/delivery/dashboard`, `/orders/[id]`, `/notifications` |

---

## Key Architecture Rules (from PROJECT_CONTEXT.md)

1. **Prices are computed only by `PricingEngine` on the server.** The UI never calculates prices.
2. **Stock changes only via `InventoryItem` methods** (`reserveStock`, `reduceStock`, `releaseReservedStock`, `updateQuantity`).
3. **Business logic lives in `src/domain/` and `src/services/`** — API routes only validate (Zod) + check roles + call a service.
4. **All `now` reads go through `src/lib/clock.ts`** — enables time travel for demo.
5. **Every sequence-diagram step logs via `trace.step(n, label, from, to)`** — persisted in SQLite `TraceLog` table for diagnostic verification.
6. **Multi-step DB changes run inside `prisma.$transaction`** — stock cannot be left reserved by a crash.
7. **No raw card data stored** — only gateway `transactionId` is persisted.

---

## Environment Variables (.env)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-min-32-chars-for-production"
```

The `.env` file is created by `npm run db:reset` if it doesn't exist. For production, change `DATABASE_URL` to a PostgreSQL connection string — Prisma supports it with only the provider change in `schema.prisma`.
