import { getSession } from "@/lib/auth";
import Link from "next/link";
import ClockWidget from "@/components/ClockWidget";
import MarketplaceClient from "./MarketplaceClient";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const session = await getSession();

  if (session?.role === "DELIVERY_PARTNER") {
    return (
      <div className="space-y-6">
        <ClockWidget />
        <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center shadow-sm space-y-4">
          <div className="text-4xl">🛵</div>
          <h2 className="text-xl font-bold text-slate-800">Delivery Partner Portal</h2>
          <p className="text-sm text-slate-600">
            The Marketplace is customer-facing. As an active Delivery Partner, your deliveries and order tracking are managed in your Delivery Dashboard.
          </p>
          <div className="pt-2">
            <Link
              href="/delivery/dashboard"
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow transition"
            >
              Go to Delivery Dashboard →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (session?.role === "STORE_OWNER") {
    return (
      <div className="space-y-6">
        <ClockWidget />
        <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center shadow-sm space-y-4">
          <div className="text-4xl">🏪</div>
          <h2 className="text-xl font-bold text-slate-800">Store Owner Console</h2>
          <p className="text-sm text-slate-600">
            The Customer Marketplace is restricted for Store Owners. Please manage your products, pricing decay rules, and store orders from your Store Dashboard.
          </p>
          <div className="pt-2">
            <Link
              href="/store"
              className="inline-block bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow transition"
            >
              Go to Store Dashboard →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (session?.role === "ADMIN") {
    return (
      <div className="space-y-6">
        <ClockWidget />
        <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center shadow-sm space-y-4">
          <div className="text-4xl">🛡️</div>
          <h2 className="text-xl font-bold text-slate-800">Administrator Console</h2>
          <p className="text-sm text-slate-600">
            The Customer Marketplace is customer-facing. Please use the Administrator Console to manage stores and platform operations.
          </p>
          <div className="pt-2">
            <Link
              href="/admin"
              className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow transition"
            >
              Go to Admin Dashboard →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <MarketplaceClient />;
}
