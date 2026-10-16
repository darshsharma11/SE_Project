"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DeliveryItem {
  deliveryId: number;
  orderId: number;
  deliveryAddress: string;
  trackingNumber: string;
  status: string;
  order: {
    orderId: number;
    orderNumber: string;
    totalAmount: number;
    status: string;
    store: { storeName: string; address: string };
    customer: { user: { name: string; phone: string } };
    items: {
      orderItemId: number;
      quantity: number;
      unitPrice: number;
      product: { name: string; category: string };
    }[];
    statusHistory: { status: string; note: string; timestamp: string }[];
  };
}

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PENDING: { label: "Pending", color: "text-slate-600", bg: "bg-slate-100 border-slate-200", dot: "bg-slate-400" },
  ASSIGNED: { label: "Assigned to You", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  ACCEPTED: { label: "Accepted", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500" },
  DELIVERED: { label: "Delivered ✓", color: "text-slate-600", bg: "bg-slate-100 border-slate-300", dot: "bg-slate-400" },
  CANCELLED: { label: "Cancelled", color: "text-rose-700", bg: "bg-rose-50 border-rose-200", dot: "bg-rose-500" },
};

const ORDER_STATUS_MAP: Record<string, string> = {
  PLACED: "Order Placed",
  CONFIRMED: "Payment Confirmed",
  PREPARING: "Store Preparing",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default function DeliveryDashboardPage() {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [expandedDelivery, setExpandedDelivery] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/delivery/assignments");
      const data = await res.json();
      if (data.success) {
        setDeliveries(data.data);
      } else {
        setError(data.error || "Failed to load deliveries");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 10000);
    return () => clearInterval(interval);
  }, [fetchDeliveries]);

  const doAction = async (deliveryId: number, action: string) => {
    setActionLoading((prev) => ({ ...prev, [deliveryId]: true }));
    try {
      const res = await fetch(`/api/v1/delivery/${deliveryId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(`Action "${action}" completed successfully!`, "ok");
      await fetchDeliveries();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`, "err");
    } finally {
      setActionLoading((prev) => ({ ...prev, [deliveryId]: false }));
    }
  };

  const activeStatuses = ["ASSIGNED", "ACCEPTED", "OUT_FOR_DELIVERY"];
  const historyStatuses = ["DELIVERED", "CANCELLED"];

  const filteredDeliveries = deliveries.filter((d) =>
    activeTab === "ACTIVE" ? activeStatuses.includes(d.status) : historyStatuses.includes(d.status)
  );

  const assignedCount = deliveries.filter((d) => d.status === "ASSIGNED").length;
  const activeCount = deliveries.filter((d) => ["ACCEPTED", "OUT_FOR_DELIVERY"].includes(d.status)).length;
  const deliveredCount = deliveries.filter((d) => d.status === "DELIVERED").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading delivery assignments…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-base font-bold text-rose-800">Failed to Load Deliveries</h2>
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-bold transition-all ${
            toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {toast.type === "ok" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold mb-2">
              🛵 Delivery Partner Portal
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">My Delivery Assignments</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Accept assignments → pick up from store → confirm delivery.
            </p>
          </div>
          <button
            onClick={fetchDeliveries}
            className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-xl transition"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div className="text-center">
            <div className="text-2xl font-black text-blue-600 font-mono">{assignedCount}</div>
            <div className="text-[11px] text-slate-500 font-semibold uppercase mt-0.5">Pending Accept</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-purple-600 font-mono">{activeCount}</div>
            <div className="text-[11px] text-slate-500 font-semibold uppercase mt-0.5">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-slate-500 font-mono">{deliveredCount}</div>
            <div className="text-[11px] text-slate-500 font-semibold uppercase mt-0.5">Completed</div>
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
            {tab === "ACTIVE"
              ? `Active (${deliveries.filter((d) => activeStatuses.includes(d.status)).length})`
              : `History (${deliveries.filter((d) => historyStatuses.includes(d.status)).length})`}
          </button>
        ))}
      </div>

      {/* Delivery Cards */}
      {filteredDeliveries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="text-5xl">{activeTab === "ACTIVE" ? "🛵" : "✅"}</div>
          <h3 className="text-base font-bold text-slate-700">
            {activeTab === "ACTIVE" ? "No active assignments" : "No completed deliveries yet"}
          </h3>
          <p className="text-xs text-slate-400">
            {activeTab === "ACTIVE"
              ? "New delivery assignments will appear here automatically."
              : "Your completed deliveries will be recorded here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDeliveries.map((delivery) => {
            const cfg = DELIVERY_STATUS_CONFIG[delivery.status] || DELIVERY_STATUS_CONFIG.PENDING;
            const isExpanded = expandedDelivery === delivery.deliveryId;
            const isLoading = actionLoading[delivery.deliveryId];
            const orderStatus = delivery.order?.status;

            return (
              <div
                key={delivery.deliveryId}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${
                  delivery.status === "ASSIGNED"
                    ? "border-blue-300 ring-1 ring-blue-100"
                    : "border-slate-200"
                }`}
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Header Row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-sm">
                          {delivery.order?.orderNumber}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        <span className="font-mono text-slate-600">{delivery.trackingNumber}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-slate-900 font-mono">₹{delivery.order?.totalAmount}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Order: {ORDER_STATUS_MAP[orderStatus] || orderStatus}
                      </div>
                    </div>
                  </div>

                  {/* Store & Customer */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-amber-50 rounded-xl border border-amber-100 p-3">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">📦 Pickup From</p>
                      <p className="text-xs font-bold text-slate-800">{delivery.order?.store?.storeName}</p>
                      <p className="text-[11px] text-slate-500">{delivery.order?.store?.address}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">📍 Deliver To</p>
                      <p className="text-xs font-bold text-slate-800">{delivery.order?.customer?.user?.name}</p>
                      <p className="text-[11px] text-slate-500">{delivery.deliveryAddress}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-1.5">
                    {delivery.order?.items?.map((item) => (
                      <div key={item.orderItemId} className="flex justify-between text-xs text-slate-700">
                        <span>
                          <span className="text-slate-400 font-mono">×{item.quantity}</span>{" "}
                          {item.product.name}
                          <span className="text-slate-400 text-[10px] ml-1 uppercase">({item.product.category})</span>
                        </span>
                        <span className="font-mono font-semibold">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons — based on delivery status */}
                  <div className="space-y-2">
                    {delivery.status === "ASSIGNED" && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => doAction(delivery.deliveryId, "accept")}
                          disabled={isLoading}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
                        >
                          {isLoading ? "…" : "✓ Accept Assignment"}
                        </button>
                        <button
                          onClick={() => doAction(delivery.deliveryId, "decline")}
                          disabled={isLoading}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-sm font-bold rounded-xl border border-slate-200 hover:border-rose-200 transition disabled:opacity-50"
                        >
                          {isLoading ? "…" : "✕ Decline"}
                        </button>
                      </div>
                    )}

                    {delivery.status === "ACCEPTED" && orderStatus === "PREPARING" && (
                      <button
                        onClick={() => doAction(delivery.deliveryId, "out-for-delivery")}
                        disabled={isLoading}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
                      >
                        {isLoading ? "…" : "🛵 Mark as Picked Up — Out for Delivery"}
                      </button>
                    )}

                    {delivery.status === "ACCEPTED" && orderStatus !== "PREPARING" && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 font-medium">
                        ⏳ Waiting for store to confirm preparation before you can mark pickup.
                        <span className="text-slate-500 ml-1">(Order status: {orderStatus})</span>
                      </div>
                    )}

                    {delivery.status === "OUT_FOR_DELIVERY" && (
                      <button
                        onClick={() => doAction(delivery.deliveryId, "delivered")}
                        disabled={isLoading}
                        className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
                      >
                        {isLoading ? "…" : "✅ Confirm Delivery Completed"}
                      </button>
                    )}

                    {delivery.status === "DELIVERED" && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 font-bold text-center">
                        ✅ Delivery Successfully Completed
                      </div>
                    )}
                  </div>

                  {/* Status History Toggle */}
                  {delivery.order?.statusHistory && delivery.order.statusHistory.length > 0 && (
                    <div>
                      <button
                        onClick={() => setExpandedDelivery(isExpanded ? null : delivery.deliveryId)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                      >
                        {isExpanded ? "▲ Hide" : "▼ View"} Order Status History
                      </button>
                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          {delivery.order.statusHistory.map((h, i) => (
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
