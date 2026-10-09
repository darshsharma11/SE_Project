"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface OrderItem {
  orderItemId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  product: { name: string; category: string };
}

interface StoreOrder {
  orderId: number;
  orderNumber: string;
  orderDate: string;
  totalAmount: number;
  status: string;
  correlationId?: string;
  remainingSeconds: number;
  isResponseExpired: boolean;
  items: OrderItem[];
  customer: {
    user: { name: string; email: string; phone: string };
    deliveryAddress: string;
  };
  delivery?: { trackingNumber: string; status: string } | null;
  payment?: { status: string; method: string; amount: number } | null;
  statusHistory?: { status: string; note: string; timestamp: string }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PLACED: { label: "Placed", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  CONFIRMED: { label: "Awaiting Action", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  PREPARING: { label: "Preparing", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500" },
  DELIVERED: { label: "Delivered", color: "text-slate-700", bg: "bg-slate-100 border-slate-300", dot: "bg-slate-400" },
  CANCELLED: { label: "Cancelled", color: "text-rose-700", bg: "bg-rose-50 border-rose-200", dot: "bg-rose-500" },
};

function CountdownBadge({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  if (remaining <= 0) {
    return (
      <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
        ⚠ Response Expired
      </span>
    );
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const urgent = remaining < 120;

  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${urgent ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse" : "text-amber-700 bg-amber-50 border-amber-200"}`}>
      ⏱ {mins}:{String(secs).padStart(2, "0")} to respond
    </span>
  );
}

export default function StoreOrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [store, setStore] = useState<{ storeId: number; storeName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/store/orders");
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
        setStore(data.store);
      } else {
        setError(data.error || "Failed to load orders");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // auto-refresh every 10s
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleAccept = async (orderId: number) => {
    setActionLoading((prev) => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch(`/api/v1/store/orders/${orderId}/accept`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchOrders();
    } catch (e: any) {
      alert(`Accept failed: ${e.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleReject = async (orderId: number) => {
    setActionLoading((prev) => ({ ...prev, [orderId]: true }));
    try {
      const reason = rejectReason[orderId] || "Store unable to fulfill order";
      const res = await fetch(`/api/v1/store/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchOrders();
    } catch (e: any) {
      alert(`Reject failed: ${e.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const activeStatuses = ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"];
  const historyStatuses = ["DELIVERED", "CANCELLED"];

  const filteredOrders = orders.filter((o) =>
    activeTab === "ACTIVE" ? activeStatuses.includes(o.status) : historyStatuses.includes(o.status)
  );

  const pendingCount = orders.filter((o) => o.status === "CONFIRMED").length;
  const preparingCount = orders.filter((o) => o.status === "PREPARING").length;
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading store orders…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-base font-bold text-rose-800">Failed to Load Orders</h2>
        <p className="text-sm text-rose-700">{error}</p>
        <Link href="/store" className="text-xs font-bold text-emerald-700 hover:underline">
          ← Back to Store Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold mb-2">
              🏪 Store Order Management
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {store?.storeName || "My Store"} — Incoming Orders
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Accept or reject orders within 15 minutes or they auto-cancel with refund.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/store" className="text-xs font-bold text-slate-600 hover:text-slate-800 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition">
              ← Dashboard
            </Link>
            <button
              onClick={fetchOrders}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl transition"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div className="text-center">
            <div className="text-2xl font-black text-amber-600 font-mono">{pendingCount}</div>
            <div className="text-[11px] text-slate-500 font-semibold uppercase mt-0.5">Awaiting Action</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-emerald-600 font-mono">{preparingCount}</div>
            <div className="text-[11px] text-slate-500 font-semibold uppercase mt-0.5">Preparing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-slate-500 font-mono">{deliveredCount}</div>
            <div className="text-[11px] text-slate-500 font-semibold uppercase mt-0.5">Delivered</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["ACTIVE", "HISTORY"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
              activeTab === tab
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {tab === "ACTIVE" ? `Active Orders (${orders.filter(o => activeStatuses.includes(o.status)).length})` : `History (${orders.filter(o => historyStatuses.includes(o.status)).length})`}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="text-4xl">{activeTab === "ACTIVE" ? "📭" : "📦"}</div>
          <h3 className="text-base font-bold text-slate-700">
            {activeTab === "ACTIVE" ? "No active orders" : "No completed orders yet"}
          </h3>
          <p className="text-xs text-slate-400">
            {activeTab === "ACTIVE" ? "New orders from customers will appear here." : "Completed and cancelled orders will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PLACED;
            const isExpanded = expandedOrder === order.orderId;
            const isLoading = actionLoading[order.orderId];

            return (
              <div
                key={order.orderId}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${
                  order.status === "CONFIRMED" && !order.isResponseExpired
                    ? "border-amber-300 ring-1 ring-amber-200"
                    : "border-slate-200"
                }`}
              >
                {/* Order Header */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-sm">
                          {order.orderNumber}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {order.status === "CONFIRMED" && !order.isResponseExpired && (
                          <CountdownBadge seconds={order.remainingSeconds} />
                        )}
                        {order.isResponseExpired && order.status === "CONFIRMED" && (
                          <span className="text-[11px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
                            ⚠ Auto-cancelling soon
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Placed: {new Date(order.orderDate).toLocaleString()} •{" "}
                        <span className="text-slate-600 font-semibold">{order.customer.user.name}</span>{" "}
                        ({order.customer.user.phone})
                      </p>
                      {order.delivery && (
                        <p className="text-xs font-mono text-slate-500">
                          📦 Tracking: {order.delivery.trackingNumber}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xl font-black text-slate-900 font-mono">₹{order.totalAmount}</div>
                      {order.payment && (
                        <div className={`text-[10px] font-mono font-bold mt-0.5 ${
                          order.payment.status === "SUCCESSFUL" ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {order.payment.method} • {order.payment.status}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-1.5">
                    {order.items.map((item) => (
                      <div key={item.orderItemId} className="flex justify-between items-center text-xs text-slate-700">
                        <span>
                          <span className="text-slate-400 font-mono">×{item.quantity}</span>{" "}
                          <span className="font-medium">{item.product.name}</span>{" "}
                          <span className="text-slate-400 uppercase text-[10px]">({item.product.category})</span>
                        </span>
                        <span className="font-mono font-semibold">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200 text-xs text-slate-500">
                      📍 Deliver to: <span className="font-semibold text-slate-700">{order.customer.deliveryAddress || "On file"}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {order.status === "CONFIRMED" && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleAccept(order.orderId)}
                          disabled={isLoading}
                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? "Processing…" : "✓ Accept Order"}
                        </button>
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.orderId)}
                          className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition"
                        >
                          {isExpanded ? "Hide Reject" : "✕ Reject…"}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <label className="block text-xs font-semibold text-slate-600">
                            Rejection reason (optional):
                          </label>
                          <input
                            type="text"
                            value={rejectReason[order.orderId] || ""}
                            onChange={(e) =>
                              setRejectReason((prev) => ({ ...prev, [order.orderId]: e.target.value }))
                            }
                            placeholder="e.g. Item out of stock, store closed…"
                            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300"
                          />
                          <button
                            onClick={() => handleReject(order.orderId)}
                            disabled={isLoading}
                            className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
                          >
                            {isLoading ? "Processing…" : "✕ Confirm Rejection & Refund"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status History */}
                  {order.statusHistory && order.statusHistory.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => setExpandedOrder(isExpanded && order.status !== "CONFIRMED" ? null : order.orderId)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                      >
                        {isExpanded && order.status !== "CONFIRMED" ? "▲ Hide" : "▼ View"} Status History
                      </button>
                      {isExpanded && order.status !== "CONFIRMED" && (
                        <div className="mt-3 space-y-2">
                          {order.statusHistory.map((h, i) => (
                            <div key={i} className="flex items-start gap-3 text-xs">
                              <span className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                              <div>
                                <span className="font-bold text-slate-700">{h.status}</span>
                                <span className="text-slate-400 ml-2">{new Date(h.timestamp).toLocaleString()}</span>
                                {h.note && <p className="text-slate-500 mt-0.5">{h.note}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
