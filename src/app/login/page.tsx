"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DemoAccount {
  label: string;
  role: string;
  email: string;
  note: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Administrator",
    role: "ADMIN",
    email: "admin@zerowaste.org",
    note: "Platform governance & store verification",
  },
  {
    label: "Store Owner (FreshMart)",
    role: "STORE_OWNER",
    email: "freshmart.owner@gmail.com",
    note: "Verified store in Linking Road, Bandra",
  },
  {
    label: "Store Owner (GreenLeaf)",
    role: "STORE_OWNER",
    email: "greenleaf.owner@gmail.com",
    note: "Verified store in Hill Road, Bandra",
  },
  {
    label: "Delivery Partner 1",
    role: "DELIVERY_PARTNER",
    email: "partner1@zerowaste.org",
    note: "Vehicle MH 02 AB 1234",
  },
  {
    label: "Delivery Partner 2",
    role: "DELIVERY_PARTNER",
    email: "partner2@zerowaste.org",
    note: "Vehicle MH 02 CD 5678",
  },
  {
    label: "Customer (Rahul)",
    role: "CUSTOMER",
    email: "rahul.customer@gmail.com",
    note: "Bandra West address",
  },
  {
    label: "Customer (Sneha)",
    role: "CUSTOMER",
    email: "sneha.customer@gmail.com",
    note: "Khar West address",
  },
  {
    label: "Customer (Arjun)",
    role: "CUSTOMER",
    email: "arjun.customer@gmail.com",
    note: "Santacruz West address",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const performLogin = async (loginEmail: string, loginPass: string) => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Role-based redirect
      switch (data.user.role) {
        case "CUSTOMER":
          router.push("/customer/dashboard");
          break;
        case "STORE_OWNER":
          router.push("/store/dashboard");
          break;
        case "DELIVERY_PARTNER":
          router.push("/delivery/dashboard");
          break;
        case "ADMIN":
          router.push("/admin/dashboard");
          break;
        default:
          router.push("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  const handleOneClickDemo = (accEmail: string) => {
    setEmail(accEmail);
    setPassword("Password123!");
    performLogin(accEmail, "Password123!");
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Sign In to Your Account</h1>
        <p className="text-sm text-slate-600 mt-1">
          Use standard credentials or click any demo role below for 1-click evaluation access.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Login Form */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 text-base mb-4">Credentials Sign In</h2>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-md transition text-sm shadow disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Need a customer account?{" "}
            <Link href="/register" className="text-emerald-600 hover:underline font-semibold">
              Register here
            </Link>
          </div>
        </div>

        {/* Demo Credentials Quick Switcher */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 text-base">Demo Credentials (1-Click Access)</h2>
            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              Pass: Password123!
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleOneClickDemo(acc.email)}
                disabled={loading}
                className="text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                      {acc.label}
                    </span>
                    <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {acc.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
                    {acc.email}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-2 truncate">
                  {acc.note}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
