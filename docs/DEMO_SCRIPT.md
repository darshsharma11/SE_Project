# Evaluator Demonstration Script: Expiry-Based Grocery Marketplace

> **Zero-Login Evaluator Demonstration Guide**
> 
> In Demo Mode (`DEMO_MODE="true"`), the application features a persistent **Demo Role Switcher** strip at the top of every page. You do **not** need multiple browser profiles, incognito windows, or login credentials.
> Simply click any of the 4 role buttons in the switcher strip to switch immediately into that role:
>
> | Role Button | Persona Name | Seeded Account | Role Dashboard | Primary Workflows |
> |-------------|--------------|----------------|----------------|-------------------|
> | 🛒 **Customer** | Rahul Verma | `rahul.customer@gmail.com` | `/marketplace` | Browse decay prices, product detail, 15-min cart hold, checkout, my orders & tracking |
> | 🏪 **Store Owner** | Ramesh Patel | `freshmart.owner@gmail.com` | `/store` | Product inventory, custom decay pricing rules, live price preview, incoming orders |
> | 🛵 **Delivery Partner** | Vikram Singh | `partner1@zerowaste.org` | `/delivery/dashboard` | Assigned deliveries, status progression (`ACCEPTED` → `OUT_FOR_DELIVERY` → `DELIVERED`) |
> | 🛡️ **Administrator** | Admin Officer | `admin@zerowaste.org` | `/admin` | Store verification (BR-1), batch decay pricing runner, time-travel simulation |

---

## 1. Quick Setup (Run Once Before Demo)

```bash
# 1. Reset and deterministically seed database
npm run db:reset

# 2. Start local server
npm run dev
```

Open your browser to: **`http://localhost:3000`**

---

## 2. Role-Based Demonstration Walkthrough

### Part 1: Customer Shopping & Dynamic Expiry-Based Decay Pricing
**Active Persona:** Click **Customer** (`Rahul Verma`)

1. The app automatically routes to **Marketplace** (`http://localhost:3000/marketplace`).
2. Notice the customer-specific navigation in the top bar: **Home**, **🛒 Marketplace**, **🛍️ Cart**, **📦 My Orders**, and **🔔 Notifications**.
3. Observe live products organized across expiry bands:
   - 🟢 `STANDARD` (72h+ remaining): Baseline pricing.
   - 🟡 `SOON` (24h–72h remaining): Moderate decay discount.
   - 🟠 `URGENT` (6h–24h remaining): Steep discount.
   - 🔴 `CRITICAL` (0h–6h remaining): Deep discount approaching price floor / maximum discount cap.
4. Filter by category (e.g. **Dairy**) or search for **"Milk"**.
5. Click **Show Details** on *Fresh Whole Milk 1L* (`/products/1`).
6. Observe: original price, current dynamic decay price, savings percentage, live countdown to expiry, and next price recalculation window.
7. Select quantity (e.g. `2`) and click **Add to Cart**.
8. Notice the confirmation showing that the item was locked into the cart under the **15-Minute Dynamic Price Hold** (BR-7).

---

### Part 2: Multi-Store Cart & Checkout (Path A — Successful Purchase)
**Active Persona:** In **Customer** mode (`Rahul Verma`)

1. Click **🛍️ Cart** (`/cart`) in the navigation.
2. Observe:
   - Items are grouped cleanly by store.
   - The active **15-Minute Price Hold Countdown** displays live remaining seconds.
   - Stock availability is verified against the store's inventory.
3. Click **Proceed to Checkout**.
4. In the checkout modal, click the **Success Card** preset (`4111 1111 1111 1111`).
5. Click **Pay & Place Order**.
6. Observe:
   - Orders are split per store.
   - Payment is authorized and recorded.
   - Store inventory is decremented.
   - The confirmation card displays order numbers and provides a link to **My Orders Portal →**.
7. Click **My Orders Portal →** (`/customer/dashboard`) to view your new orders and tracking status.

---

### Part 3: Store Owner Console (Multi-Store Inventory, Analytics & Pricing Rules)
**Active Persona:** Click **Store Owner** (`Ramesh Patel`) in the top Demo Switcher

1. The browser instantly switches to the **Store Owner Console** (`/store`).
2. Notice the navigation changes cleanly to role-appropriate links: **Home**, **🏪 Products & Rules**, **📋 Store Orders**, and **🔔 Notifications**. Customer Marketplace and Cart links are not shown.
3. Observe FreshMart's console:
   - FreshMart's verified status (`✓ Verified Store (BR-1)`) and address.
   - **Store Performance & Inventory Analytics**: Total Listed products, Available Stock, Near-Expiry items (<24h), Store Orders, and Revenue.
   - Inventory items: *Ripe Bananas Robusta*, *Fresh Whole Milk*, *Artisan Sourdough*.
4. **Switch to GreenLeaf Organic Grocers**:
   - In the top Evaluator Store Switcher strip, click **🌿 GreenLeaf (Priya)**.
   - Notice the page reloads cleanly for GreenLeaf Organic Grocers:
     - Verified status, updated store analytics.
     - Store catalog displays GreenLeaf items: *Organic Paneer 200g*, *Fresh Croissants (Pack of 2)*, *Organic Button Mushrooms*.
5. **Switch to Corner Daily Mart (Pending Verification)**:
   - Click **🏬 CornerMart (Devendra)**.
   - Notice status: `⚠ PENDING_VERIFICATION`.
   - The **+ List New Near-Expiry Product** button is safely disabled per BR-1 until verified by an Administrator.
6. **Inspect Store Orders**:
   - Click **📋 Manage Orders** (`/store/orders`).
   - Observe that only incoming orders for the active store are visible (e.g. GreenLeaf orders for Priya; FreshMart orders for Ramesh).
   - Click **Accept Order** to transition status to `PREPARING`.

---

### Part 4: Delivery Partner Portal (Assigned Deliveries & Status Updates)
**Active Persona:** Click **Delivery Partner** (`Vikram Singh`) in the Demo Switcher

1. The browser instantly switches to the **Delivery Partner Portal** (`/delivery/dashboard`).
2. Notice the navigation strictly shows: **Home**, **🛵 Deliveries**, and **🔔 Notifications**. (No Customer Marketplace or Cart links).
3. View your assigned deliveries under **Assigned to You**.
4. Progress the delivery through its authorized lifecycle:
   - Click **Accept Assignment** → status transitions to `ACCEPTED`.
   - Click **Mark Out for Delivery** → status transitions to `OUT_FOR_DELIVERY`.
   - Click **Confirm Delivery Completed** → status transitions to `DELIVERED`.
5. Switch back to **Customer** (`Rahul Verma`) and navigate to **📦 My Orders**:
   - The order status shows **DELIVERED** with complete timestamped delivery history.

---

### Part 5: Simulated Payment Failure & Stock Rollback (Path B)
**Active Persona:** Click **Customer** (`Rahul Verma`)

1. From `/marketplace`, add an available item to the cart.
2. Go to `/cart` and click **Proceed to Checkout**.
3. In the checkout modal, click the **Fail Card** preset (card ending in `0000`).
4. Click **Pay & Place Order**.
5. Observe:
   - Payment is declined by the simulation gateway.
   - Clear failure notification: `Payment Failed • Stock Safely Rolled Back`.
   - All temporarily reserved stock is automatically returned to available store inventory.

---

### Part 6: Administrator Console (Pricing Management, Verification & Time Travel)
**Active Persona:** Click **Administrator** (`Admin Officer`) in the Demo Switcher

1. The browser routes to the **Administrator Console** (`/admin`).
2. Notice the navigation shows: **Home**, **🛡️ Admin Panel**, and **🔔 Notifications**.
3. **Inspect the Dynamic Pricing Management Tab**:
   - **Pricing Rules Editor**: View all global and store-scoped pricing rules (discount rate, threshold, max discount cap, price floor). Click **✏ Edit Rule** on Dairy to adjust parameters; verify that changes save to SQLite and trigger immediate recalculation for assigned products.
   - **Cross-Store Product Pricing Overview**: Search by product name or filter by Store (FreshMart vs GreenLeaf), Category, or Expiry Band (Critical, Urgent, Soon, Standard).
   - **Explain & History**: Click **🔍 Explain & History** on any product (e.g. *Organic Paneer 200g* or *Fresh Whole Milk 1L*). Observe the step-by-step mathematical breakdown showing the exact numbers computed by the backend `PricingEngine` and the persistent `PriceHistory` log.
   - **Live Expiry-Decay Simulation**: In the simulator at the bottom, select any product and drag the **Hours Remaining** slider or click preset buttons (`72h`, `24h`, `8h`, `2h`, `0h`). Observe live calculation matching the backend formula with explicit "Non-Persistent Preview" indicator.
4. **Inspect Stores & Verification Tab**:
   - View partner stores with verification status (`VERIFIED` vs `PENDING`).
   - One-click store verification toggle (`BR-1`).
5. **Inspect Simulation Clock & Jobs Tab**:
   - Advance the virtual clock by **+6 hours** in the Time Travel widget:
     - Simulates time passage, immediately updating expiry bands and decay discounts.
   - Click **⚡ Run Pricing Job Now** to execute scheduled recalculation across all active products.
   - Click **↺ Reset Clock to Real System Time** to return the platform to current time safely.

---

### Part 7: Role Isolation & Direct URL Access Verification

Verify that route guards enforce proper boundaries:
1. While logged in as **Delivery Partner** (`Vikram Singh`), manually navigate to `http://localhost:3000/cart`:
   - Access is restricted with: `Customer Access Required: Shopping cart is only accessible to Customers.`
   - Active persona remains `DELIVERY_PARTNER` (never silently switched to Customer).
2. While logged in as **Delivery Partner**, manually navigate to `http://localhost:3000/marketplace`:
   - A friendly access notice displays: `Delivery Partner Portal: The Marketplace is customer-facing.` with a button to return to the Delivery Dashboard.
3. While logged in as **Customer**, manually navigate to `http://localhost:3000/store` or `http://localhost:3000/admin`:
   - Access is restricted with: `Store Owner Access Required` or `Administrator Access Required`.

---

## 3. Resetting the Demo

If at any point during your evaluation or demonstration you wish to return to a clean baseline state:

```bash
npm run db:reset
```

The database will be restored with fresh seed timestamps, active orders, and clean inventory.
