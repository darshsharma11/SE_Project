import { getSession } from "@/lib/auth";
import Link from "next/link";
import ClockWidget from "@/components/ClockWidget";
import CartClient from "./CartClient";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await getSession();

  if (!session || session.role !== "CUSTOMER") {
    let dashboardHref = "/";
    let dashboardLabel = "Go to Home";

    if (session?.role === "DELIVERY_PARTNER") {
      dashboardHref = "/delivery/dashboard";
      dashboardLabel = "Go to Delivery Dashboard →";
    } else if (session?.role === "STORE_OWNER") {
      dashboardHref = "/store";
      dashboardLabel = "Go to Store Dashboard →";
    } else if (session?.role === "ADMIN") {
      dashboardHref = "/admin";
      dashboardLabel = "Go to Admin Dashboard →";
    } else if (!session) {
      dashboardHref = "/login";
      dashboardLabel = "Sign In as Customer →";
    }

    return (
      <div className="space-y-6">
        <ClockWidget />
        <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center shadow-sm space-y-4">
          <div className="text-4xl">🛍️</div>
          <h2 className="text-xl font-bold text-slate-800">Customer Access Required</h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            The shopping cart and checkout are reserved for customers. You are currently signed in as{" "}
            <span className="font-semibold text-amber-600">{session?.role || "GUEST"}</span>.
          </p>
          <div className="pt-2">
            <Link
              href={dashboardHref}
              className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition"
            >
              {dashboardLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <CartClient />;
}
