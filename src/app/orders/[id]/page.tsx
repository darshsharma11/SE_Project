"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface TrackingData {
  orderId: number;
  orderNumber: string;
  orderDate: string;
  totalAmount: number;
  status: string;
  correlationId?: string;
  store: { storeName: string; address: string };
  items: {
    orderItemId: number;
    quantity: number;
    unitPrice: number;
    product: { name: string; category: string };
  }[];
  payment: { status: string; method: string; amount: number } | null;
  delivery: {
    deliveryId: number;
    trackingNumber: string;
    status: string;
    deliveryAddress: string;
    deliveryPartner?: {
      vehicleNumber: string;
      user: { name: string; phone: string };
    } | null;
  } | null;
  statusHistory: { status: string; note: string; timestamp: string }[];
}

const STATUS_STEPS = [
  { status: "PLACED", icon: "📝", label: "Order Placed", desc: "Your order has been received" },
  { status: "CONFIRMED", icon: "💳", label: "Payment Confirmed", desc: "Payment processed, notifying store" },
  { status: "PREPARING", icon: "👨‍🍳", label: "Store Preparing", desc: "Store is packing your items" },
  { status: "OUT_FOR_DELIVERY", icon: "🛵", label: "Out for Delivery", desc: "Partner is on the way" },
  { status: "DELIVERED", icon: "✅", label: "Delivered", desc: "Your order has been delivered" },
];

const STATUS_ORDER = ["PLACED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];

function StatusTimeline({ currentStatus, isCancelled }: { currentStatus: string; isCancelled: boolean }) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
        <span className="text-3xl">❌</span>
        <div>
          <p className="font-bold text-rose-800 text-sm">Order Cancelled</p>
          <p className="text-xs text-rose-600">Your payment has been refunded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {STATUS_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={step.status} className="flex gap-4">
            {/* Connector */}
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 border-2 transition-all ${
                  isCompleted
                    ? "bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-200"
                    : isCurrent
                    ? "bg-white border-emerald-400 ring-4 ring-emerald-100"
                    : "bg-slate-100 border-slate-200"
                }`}
              >
                {isCompleted ? (isCurrent ? step.icon : "✓") : <span className="opacity-40">{step.icon}</span>}
              </div>
              {idx < STATUS_STEPS.length - 1 && (
                <div
                  className={`w-0.5 h-8 mt-1 rounded-full transition-all ${
                    idx < currentIdx ? "bg-emerald-400" : "bg-slate-200"
                  }`}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-8 ${idx === STATUS_STEPS.length - 1 ? "pb-0" : ""}`}>
              <p className={`text-sm font-bold ${isCompleted ? "text-slate-900" : "text-slate-400"}`}>
                {step.label}
                {isCurrent && (
                  <span className="ml-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-pulse">
                    Current
                  </span>
                )}
              </p>
              <p className={`text-xs mt-0.5 ${isCompleted ? "text-slate-500" : "text-slate-300"}`}>
                {step.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderTrackingPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/orders/${params.id}/track`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.data);
      } else {
        setError(data.error || "Order not found");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading order tracking…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-base font-bold text-rose-800">Order Not Found</h2>
        <p className="text-sm text-rose-700">{error}</p>
        <Link href="/customer/dashboard" className="text-xs font-bold text-emerald-700 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const isCancelled = order.status === "CANCELLED";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold mb-2">
              📦 Order Tracking
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-mono">{order.orderNumber}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Placed {new Date(order.orderDate).toLocaleString()} • {order.store.storeName}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-2xl font-black text-slate-900 font-mono">₹{order.totalAmount}</div>
            {order.payment && (
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                order.payment.status === "SUCCESSFUL" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}>
                {order.payment.method} • {order.payment.status}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-5">Delivery Timeline</h2>
          <StatusTimeline currentStatus={order.status} isCancelled={isCancelled} />
        </div>

        {/* Delivery Info Panel */}
        <div className="space-y-4">
          {/* Tracking */}
          {order.delivery && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-800">Delivery Info</h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Tracking Number</span>
                  <span className="font-mono font-bold text-slate-800">{order.delivery.trackingNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Delivery Status</span>
                  <span className={`font-bold ${order.delivery.status === "DELIVERED" ? "text-emerald-600" : "text-slate-700"}`}>
                    {order.delivery.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Address</span>
                  <span className="font-medium text-slate-700 text-right max-w-[180px]">{order.delivery.deliveryAddress}</span>
                </div>
              </div>

              {order.delivery.deliveryPartner && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivery Partner</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-base">🛵</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{order.delivery.deliveryPartner.user.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {order.delivery.deliveryPartner.user.phone} •{" "}
                        <span className="font-mono">{order.delivery.deliveryPartner.vehicleNumber}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Order Items */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800">Order Items</h2>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.orderItemId} className="flex justify-between items-center text-xs">
                  <span>
                    <span className="text-slate-400 font-mono">×{item.quantity}</span>{" "}
                    <span className="font-medium text-slate-800">{item.product.name}</span>{" "}
                    <span className="text-slate-400 text-[10px] uppercase">({item.product.category})</span>
                  </span>
                  <span className="font-mono font-semibold text-slate-800">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trace Link */}
          {order.correlationId && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sequence Trace</p>
              <p className="text-xs font-mono text-slate-600 truncate mb-2">{order.correlationId}</p>
              <Link
                href={`/trace`}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                🔍 View steps 1–40 in Viva Trace →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Full Status History */}
      {order.statusHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Full Status History</h2>
          <div className="space-y-3">
            {[...order.statusHistory].reverse().map((h, i) => (
              <div key={i} className="flex items-start gap-4 text-xs">
                <div className="text-slate-300 font-mono pt-0.5 w-28 shrink-0">
                  {new Date(h.timestamp).toLocaleString()}
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800">{h.status}</span>
                    {h.note && <p className="text-slate-500 mt-0.5">{h.note}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Link href="/customer/dashboard" className="text-xs font-bold text-slate-600 hover:text-slate-800 border border-slate-200 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 transition">
          ← My Orders
        </Link>
        <button
          onClick={fetchOrder}
          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl transition"
        >
          ↻ Refresh Status
        </button>
      </div>
    </div>
  );
}
