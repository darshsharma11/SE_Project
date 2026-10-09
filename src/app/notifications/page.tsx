"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Notification {
  notificationId: number;
  type: string;
  message: string;
  sentAt: string;
  isRead: boolean;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  ORDER_PLACED: { icon: "📝", color: "text-blue-700", bg: "bg-blue-50" },
  ORDER_STATUS: { icon: "📦", color: "text-emerald-700", bg: "bg-emerald-50" },
  ORDER_CANCELLED: { icon: "❌", color: "text-rose-700", bg: "bg-rose-50" },
  PAYMENT_SUCCESS: { icon: "💳", color: "text-purple-700", bg: "bg-purple-50" },
  PAYMENT_FAILED: { icon: "⚠️", color: "text-amber-700", bg: "bg-amber-50" },
  DELIVERY_UPDATE: { icon: "🛵", color: "text-blue-700", bg: "bg-blue-50" },
  PRICE_CHANGE: { icon: "💸", color: "text-orange-700", bg: "bg-orange-50" },
  SYSTEM: { icon: "🔔", color: "text-slate-700", bg: "bg-slate-50" },
};

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications");
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
        setUnreadCount(data.unreadCount);
      } else {
        setError(data.error || "Failed to load notifications");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: number) => {
    try {
      await fetch(`/api/v1/notifications/${notificationId}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error("Failed to mark as read:", e);
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/v1/notifications", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredNotifications =
    filter === "UNREAD" ? notifications.filter((n) => !n.isRead) : notifications;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading notifications…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-base font-bold text-rose-800">Failed to Load Notifications</h2>
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold mb-2">
              🔔 Notification Centre
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Notifications</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {unreadCount > 0 ? (
                <span className="font-bold text-emerald-700">{unreadCount} unread</span>
              ) : (
                "All caught up!"
              )}
              {" "}• {notifications.length} total
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll}
              className="text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition disabled:opacity-50"
            >
              {markingAll ? "Marking…" : "✓ Mark All as Read"}
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
          {(["ALL", "UNREAD"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition border ${
                filter === f
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {f === "ALL"
                ? `All (${notifications.length})`
                : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="text-5xl">🔕</div>
          <h3 className="text-base font-bold text-slate-700">
            {filter === "UNREAD" ? "No unread notifications" : "No notifications yet"}
          </h3>
          <p className="text-xs text-slate-400">
            {filter === "UNREAD"
              ? "You've read all your notifications."
              : "Order updates, delivery alerts, and more will appear here."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {filteredNotifications.map((notif) => {
            const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.SYSTEM;
            return (
              <div
                key={notif.notificationId}
                className={`flex items-start gap-4 p-5 transition hover:bg-slate-50 cursor-pointer ${
                  !notif.isRead ? "bg-white" : "opacity-75"
                }`}
                onClick={() => !notif.isRead && markAsRead(notif.notificationId)}
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${cfg.bg}`}
                >
                  {cfg.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-semibold ${cfg.color} uppercase tracking-wide`}>
                      {notif.type.replace(/_/g, " ")}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatRelativeTime(notif.sentAt)}
                      </span>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-800 mt-1 leading-snug">{notif.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(notif.sentAt).toLocaleString()}
                    {!notif.isRead && (
                      <span className="ml-2 text-emerald-600 font-semibold">• Click to mark read</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Back Link */}
      <div>
        <Link href="/" className="text-xs font-bold text-slate-500 hover:text-slate-700 transition">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
