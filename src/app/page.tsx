import Link from "next/link";
import ClockWidget from "@/components/ClockWidget";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const productCount = await prisma.product.count();
  const storeCount = await prisma.store.count();
  const userCount = await prisma.user.count();

  return (
    <div className="space-y-8">
      {/* Clock Simulation Bar */}
      <ClockWidget />

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-8 text-white shadow-lg">
        <div className="max-w-3xl">
          <span className="inline-block px-3 py-1 bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            SE Case Study • Release 1.0
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            Dynamic Expiry-Based Grocery & Zero-Waste Marketplace
          </h1>
          <p className="text-emerald-100 text-sm sm:text-base leading-relaxed mb-6">
            Connecting partner grocery stores with conscious shoppers to rescue near-expiry inventory.
            An automated hourly decay-pricing engine lowers prices dynamically until expiry, cutting food waste.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/marketplace"
              className="bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-extrabold px-5 py-2.5 rounded-lg shadow transition text-sm flex items-center gap-1.5"
            >
              <span>🛒 Open Marketplace (Live Decay Prices)</span>
            </Link>
            <Link
              href="/login"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-lg border border-white/20 transition text-sm"
            >
              Sign In (Demo Roles)
            </Link>
            <Link
              href="/trace"
              className="bg-slate-800/80 hover:bg-slate-800 text-emerald-300 border border-emerald-400/40 font-semibold px-4 py-2.5 rounded-lg transition text-sm"
            >
              Sequence Diagram Live Trace
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-3xl font-bold text-slate-800">{productCount}</div>
          <div className="text-sm font-semibold text-slate-600 mt-1">Seeded Products</div>
          <div className="text-xs text-slate-400 mt-2">Spanning Critical, Urgent, Soon, and Standard expiry bands.</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-3xl font-bold text-slate-800">{storeCount}</div>
          <div className="text-sm font-semibold text-slate-600 mt-1">Verified Partner Stores</div>
          <div className="text-xs text-slate-400 mt-2">FreshMart Supermarket and GreenLeaf Organic Grocers.</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-3xl font-bold text-slate-800">{userCount}</div>
          <div className="text-sm font-semibold text-slate-600 mt-1">Registered Users</div>
          <div className="text-xs text-slate-400 mt-2">Customers, Store Owners, Delivery Partners, and Administrator.</div>
        </div>
      </div>

      {/* Modules Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Core Module Implementation Scope</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="border border-slate-100 bg-slate-50 p-4 rounded-lg">
            <div className="font-bold text-emerald-700 mb-1">Module 1: Product, Expiry & Dynamic Pricing</div>
            <p className="text-slate-600 text-xs mb-2">Sequence Diagram steps 1 - 14.</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
              <li>Product search with stock availability check</li>
              <li>Dynamic decay calculation via PricingEngine & PricingRule</li>
              <li>Hourly recalculation & manual price/quantity edit reaction</li>
              <li>Automated expiry band classification & auto-removal</li>
            </ul>
          </div>
          <div className="border border-slate-100 bg-slate-50 p-4 rounded-lg">
            <div className="font-bold text-emerald-700 mb-1">Module 2: Cart, Order, Payment & Delivery</div>
            <p className="text-slate-600 text-xs mb-2">Sequence Diagram steps 15 - 48.</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
              <li>15-minute cart price hold (BR-7)</li>
              <li>Stock reservation on checkout (step 23)</li>
              <li>Mock PaymentGateway authorization & failure rollback (step 41-45)</li>
              <li>Delivery assignment & partner status progression (step 32-40)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
