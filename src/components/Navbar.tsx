"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface UserInfo {
  userId: number;
  name: string;
  email: string;
  role: string;
}

const DEMO_ROLES = [
  { role: "CUSTOMER", label: "Customer", icon: "🛒", targetUrl: "/marketplace" },
  { role: "STORE_OWNER", label: "Store Owner", icon: "🏪", targetUrl: "/store" },
  { role: "DELIVERY_PARTNER", label: "Delivery Partner", icon: "🛵", targetUrl: "/delivery/dashboard" },
  { role: "ADMIN", label: "Administrator", icon: "🛡️", targetUrl: "/admin" },
] as const;

interface NavbarProps {
  initialUser?: UserInfo | null;
}

export default function Navbar({ initialUser }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser === undefined);
  const [unreadCount, setUnreadCount] = useState(0);
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);

  useEffect(() => {
    if (initialUser !== undefined) {
      setUser(initialUser);
      setLoading(false);
    }
  }, [initialUser]);

  const fetchNotifCount = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications");
      const data = await res.json();
      if (data.success) setUnreadCount(data.unreadCount ?? 0);
    } catch {}
  }, []);

  const fetchSession = useCallback(() => {
    fetch("/api/v1/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user);
          setDemoMode(data.demoMode ?? true);
          fetchNotifCount();
        } else {
          setUser(null);
          setDemoMode(data.demoMode ?? true);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [fetchNotifCount]);

  useEffect(() => {
    fetchSession();
  }, [pathname, fetchSession]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchNotifCount, 20000);
    return () => clearInterval(interval);
  }, [user, fetchNotifCount]);

  const handleRoleSwitch = async (
    role: "CUSTOMER" | "STORE_OWNER" | "DELIVERY_PARTNER" | "ADMIN",
    email?: string
  ) => {
    try {
      setSwitchingRole(role + (email ? `-${email}` : ""));
      const res = await fetch("/api/v1/auth/demo-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, email }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        const target = DEMO_ROLES.find((r) => r.role === role);
        if (target && typeof window !== "undefined") {
          window.location.href = target.targetUrl;
        }
      } else {
        alert(data.error || "Failed to switch role");
      }
    } catch (err: any) {
      alert("Role switch failed: " + err.message);
    } finally {
      setSwitchingRole(null);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 shadow-md">
      {/* Top Bar: Brand, Navigation Links & User Status */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2 text-emerald-400 font-bold text-lg hover:text-emerald-300 transition">
              <span className="text-2xl">🌱</span>
              <span className="tracking-tight font-extrabold">ZeroWaste Grocers</span>
            </Link>

            <div className="hidden md:flex space-x-1.5 text-xs font-semibold">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-md transition ${
                  pathname === "/" ? "bg-slate-800 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                Home
              </Link>

              {/* Customer-Only Navigation */}
              {user?.role === "CUSTOMER" && (
                <>
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
                  <Link
                    href="/customer/dashboard"
                    className={`px-3 py-1.5 rounded-md transition ${
                      pathname.startsWith("/customer")
                        ? "bg-slate-800 text-emerald-300 border border-emerald-600/40"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    📦 My Orders
                  </Link>
                </>
              )}

              {/* Guest/Unauthenticated Navigation */}
              {!user && !loading && (
                <Link
                  href="/marketplace"
                  className={`px-3 py-1.5 rounded-md transition ${
                    pathname.startsWith("/marketplace")
                      ? "bg-emerald-600 text-white"
                      : "text-emerald-400 hover:text-emerald-300"
                  }`}
                >
                  🛒 Marketplace
                </Link>
              )}

              {/* Store Owner-Only Navigation */}
              {user?.role === "STORE_OWNER" && (
                <>
                  <Link
                    href="/store"
                    className={`px-3 py-1.5 rounded-md transition ${
                      pathname === "/store" ? "bg-amber-800 text-amber-200" : "text-amber-400 hover:text-amber-300"
                    }`}
                  >
                    🏪 Products & Rules
                  </Link>
                  <Link
                    href="/store/orders"
                    className={`px-3 py-1.5 rounded-md transition ${
                      pathname.startsWith("/store/orders")
                        ? "bg-amber-800 text-amber-200"
                        : "text-amber-400 hover:text-amber-300"
                    }`}
                  >
                    📋 Store Orders
                  </Link>
                </>
              )}

              {/* Delivery Partner-Only Navigation */}
              {user?.role === "DELIVERY_PARTNER" && (
                <Link
                  href="/delivery/dashboard"
                  className={`px-3 py-1.5 rounded-md transition ${
                    pathname.startsWith("/delivery")
                      ? "bg-blue-900 text-blue-200"
                      : "text-blue-400 hover:text-blue-300"
                  }`}
                >
                  🛵 Deliveries
                </Link>
              )}

              {/* Administrator-Only Navigation */}
              {user?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 rounded-md transition ${
                    pathname.startsWith("/admin") ? "bg-purple-900 text-purple-200" : "text-purple-400 hover:text-purple-300"
                  }`}
                >
                  🛡️ Admin Panel
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
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
                  <div className="text-xs font-semibold text-slate-100">{user.name}</div>
                  <div className="text-[11px] text-emerald-400 font-mono tracking-wider">
                    {user.role}
                  </div>
                </div>
                {!demoMode && (
                  <button
                    onClick={handleLogout}
                    className="bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 text-slate-300 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-700 transition"
                  >
                    Logout
                  </button>
                )}
              </div>
            ) : !loading && !demoMode ? (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="text-slate-200 hover:text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-slate-800 transition"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-sm transition"
                >
                  Register
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Demo Role Switcher Strip (Always accessible for evaluator) */}
      {demoMode && (
        <div className="bg-slate-950 border-t border-slate-800/80 py-1.5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-widest">
                Demo Switcher
              </span>
              <span className="text-slate-400 hidden sm:inline">Active Role:</span>
              <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {user?.role || "CUSTOMER"}
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-1.5">
              {DEMO_ROLES.map((r) => {
                const isActive = user?.role === r.role;
                const isPending = switchingRole?.startsWith(r.role);
                return (
                  <button
                    key={r.role}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRoleSwitch(r.role)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition shadow-sm ${
                      isActive
                        ? "bg-emerald-600 text-white ring-2 ring-emerald-400 font-bold"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700"
                    } ${isPending ? "opacity-50 cursor-wait" : ""}`}
                    title={`Switch active persona to ${r.label}`}
                  >
                    <span>{r.icon}</span>
                    <span>{r.label}</span>
                    {isActive && <span className="text-[10px] ml-0.5">✓</span>}
                  </button>
                );
              })}
            </div>

            {user?.role === "STORE_OWNER" && (
              <div className="w-full flex flex-wrap items-center justify-end gap-1.5 pt-1 text-[11px] border-t border-slate-900/80">
                <span className="text-amber-400 font-semibold mr-1">Active Store Owner:</span>
                <button
                  type="button"
                  onClick={() => handleRoleSwitch("STORE_OWNER", "freshmart.owner@gmail.com")}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    user.email.includes("freshmart")
                      ? "bg-amber-400 text-slate-950 font-black ring-1 ring-amber-300"
                      : "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
                  }`}
                >
                  🏪 FreshMart (Ramesh)
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSwitch("STORE_OWNER", "greenleaf.owner@gmail.com")}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    user.email.includes("greenleaf")
                      ? "bg-emerald-400 text-slate-950 font-black ring-1 ring-emerald-300"
                      : "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
                  }`}
                >
                  🌿 GreenLeaf (Priya)
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSwitch("STORE_OWNER", "cornermart.owner@gmail.com")}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    user.email.includes("cornermart")
                      ? "bg-purple-400 text-slate-950 font-black ring-1 ring-purple-300"
                      : "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
                  }`}
                >
                  🏬 CornerMart (Devendra)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
