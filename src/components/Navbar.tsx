"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

interface UserInfo {
  userId: number;
  name: string;
  email: string;
  role: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifCount = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications");
      const data = await res.json();
      if (data.success) setUnreadCount(data.unreadCount ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user);
          fetchNotifCount();
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [pathname, fetchNotifCount]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchNotifCount, 20000);
    return () => clearInterval(interval);
  }, [user, fetchNotifCount]);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  const getRoleDashboardLink = () => {
    if (!user) return "/login";
    switch (user.role) {
      case "CUSTOMER":
        return "/customer/dashboard";
      case "STORE_OWNER":
        return "/store/dashboard";
      case "DELIVERY_PARTNER":
        return "/delivery/dashboard";
      case "ADMIN":
        return "/admin/dashboard";
      default:
        return "/";
    }
  };

  return (
    <nav className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2 text-emerald-400 font-bold text-lg hover:text-emerald-300 transition">
              <span className="text-2xl">🌱</span>
              <span className="tracking-tight">ZeroWaste Grocers</span>
            </Link>

            <div className="hidden md:flex space-x-2 text-xs font-semibold">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname === "/" ? "bg-slate-800 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                Home
              </Link>
              <Link
                href="/marketplace"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname.startsWith("/marketplace") || pathname.startsWith("/products")
                    ? "bg-emerald-600 text-white"
                    : "text-emerald-400 hover:text-emerald-300"
                }`}
              >
                🛒 Marketplace
              </Link>
              <Link
                href="/cart"
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                  pathname === "/cart"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span>🛍️ Cart</span>
              </Link>
              {user?.role === "CUSTOMER" && (
                <Link
                  href="/customer/dashboard"
                  className={`px-3 py-1.5 rounded-md transition ${
                    pathname.startsWith("/customer")
                      ? "bg-slate-800 text-emerald-300"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  📦 My Orders
                </Link>
              )}
              {user?.role === "STORE_OWNER" && (
                <Link
                  href="/store/orders"
                  className={`px-3 py-1.5 rounded-md transition ${
                    pathname.startsWith("/store/orders")
                      ? "bg-amber-800 text-amber-200"
                      : "text-amber-400 hover:text-amber-300"
                  }`}
                >
                  📋 Orders
                </Link>
              )}
              {user?.role === "DELIVERY_PARTNER" && (
                <Link
                  href="/delivery/dashboard"
                  className={`px-3 py-1.5 rounded-md transition ${
                    pathname.startsWith("/delivery")
                      ? "bg-blue-900 text-blue-200"
                      : "text-blue-400 hover:text-blue-300"
                  }`}
                >
                  🛵 My Deliveries
                </Link>
              )}
              <Link
                href="/store"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname.startsWith("/store") ? "bg-slate-800 text-amber-300" : "text-amber-400 hover:text-amber-300"
                }`}
              >
                🏪 Store Portal
              </Link>
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname.startsWith("/admin") ? "bg-slate-800 text-purple-300" : "text-purple-400 hover:text-purple-300"
                }`}
              >
                🛡️ Admin
              </Link>
              <Link
                href="/trace"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname === "/trace" ? "bg-emerald-950 text-emerald-300 border border-emerald-700" : "text-slate-300 hover:text-white"
                }`}
              >
                🔍 Viva Trace
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {!loading && user ? (
              <div className="flex items-center space-x-3">
                {/* Notifications Bell */}
                <Link
                  href="/notifications"
                  className="relative p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition"
                  title="Notifications"
                >
                  <span className="text-base">🔔</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-100">{user.name}</div>
                  <div className="text-xs text-emerald-400 font-mono tracking-wider">
                    [{user.role}]
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 text-slate-300 text-xs font-medium px-3 py-2 rounded-md border border-slate-700 transition"
                >
                  Logout
                </button>
              </div>
            ) : !loading ? (
              <div className="flex items-center space-x-3">
                <Link
                  href="/login"
                  className="text-slate-200 hover:text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-slate-800 transition"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-3.5 py-1.5 rounded-md shadow-sm transition"
                >
                  Register
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
