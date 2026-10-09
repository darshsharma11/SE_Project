import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ClockWidget from "@/components/ClockWidget";
import Link from "next/link";

export default async function CustomerDashboard() {
  const session = await requireAuth(["CUSTOMER"]);
  const customer = await prisma.customer.findUnique({
    where: { customerId: session.userId },
  });

  const cart = await prisma.shoppingCart.findUnique({
    where: { customerId: session.userId },
    include: { items: true },
  });

  const orders = await prisma.order.findMany({
    where: { customerId: session.userId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      store: true,
      payment: true,
      delivery: true,
      statusHistory: {
        orderBy: { timestamp: "desc" },
      },
    },
    orderBy: { orderDate: "desc" },
  });

  const totalSpent = orders
    .filter((o) => o.status === "CONFIRMED" || o.status === "DELIVERED" || o.status === "OUT_FOR_DELIVERY")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <ClockWidget />

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
              <span>👤</span> Customer Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
              Welcome back, {session.name}
            </h1>
            <p className="text-xs text-slate-500">{session.email}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Default Delivery Address</span>
            <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 inline-block mt-0.5">
              📍 {customer?.deliveryAddress || "Standard Address"}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <Link
            href="/cart"
            className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 hover:border-emerald-400 transition block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Active Cart
              </span>
              <span className="text-xs text-emerald-600 group-hover:translate-x-1 transition font-bold">
                Open Cart →
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
              {cart?.items.length || 0} items
            </div>
            <div className="text-xs text-emerald-700 mt-1">
              ₹{cart?.totalAmount || 0} • 15m price hold guard enabled
            </div>
          </Link>

          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Orders
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
              {orders.length} Orders
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Tracked end-to-end via Sequence Trace
            </div>
          </div>

          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rescued Grocery Spending
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
              ₹{totalSpent}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Zero-waste decay pricing savings
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Your Order History</h2>
            <p className="text-xs text-slate-500">
              Orders created and partitioned per grocery store at checkout
            </p>
          </div>
          <Link
            href="/marketplace"
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl transition"
          >
            Browse Marketplace →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="text-4xl">📦</div>
            <h3 className="text-base font-bold text-slate-800">No Orders Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven&apos;t placed any orders yet. Add dynamic decay-priced items to your cart and checkout!
            </p>
            <Link
              href="/marketplace"
              className="inline-block mt-2 text-xs font-bold text-emerald-700 hover:underline"
            >
              Start shopping now →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order: any) => {
              const statusColorMap: Record<string, string> = {
                PLACED: "bg-blue-50 text-blue-700 border-blue-200",
                CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                PREPARING: "bg-amber-50 text-amber-700 border-amber-200",
                OUT_FOR_DELIVERY: "bg-purple-50 text-purple-700 border-purple-200",
                DELIVERED: "bg-slate-100 text-slate-800 border-slate-300",
                CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
              };
              const statusColor = statusColorMap[order.status] || "bg-slate-50 text-slate-700 border-slate-200";

              return (
                <div key={order.orderId} className="p-5 sm:p-6 space-y-4 hover:bg-slate-50 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-slate-900">
                          {order.orderNumber}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor}`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Placed on {new Date(order.orderDate).toLocaleString()} • Store:{" "}
                        <strong className="text-slate-700">{order.store.storeName}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900 font-mono">
                        ₹{order.totalAmount}
                      </span>
                      {order.payment && (
                        <span
                          className={`block text-[10px] font-mono font-bold ${
                            order.payment.status === "SUCCESSFUL"
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          Payment: {order.payment.status} ({order.payment.method})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Order Items Table */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                    <div className="space-y-1.5">
                      {order.items.map((it: any) => (
                        <div
                          key={it.orderItemId}
                          className="flex items-center justify-between text-xs text-slate-700"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-mono">x{it.quantity}</span>
                            <span className="font-medium text-slate-800">
                              {it.product.name}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase">
                              ({it.product.category})
                            </span>
                          </div>
                          <span className="font-mono font-semibold text-slate-800">
                            ₹{it.unitPrice * it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Footer with Track & Trace Links */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                    <span className="text-slate-500">
                      Delivery Address: {customer?.deliveryAddress || "Store Pickup"}
                    </span>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/orders/${order.orderId}`}
                        className="text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        <span>📍 Track Order</span>
                        <span>→</span>
                      </Link>
                      <Link
                        href={`/trace`}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
                      >
                        <span>🔍 Viva Trace</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
