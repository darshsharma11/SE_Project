"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ClockWidget from "@/components/ClockWidget";

interface ProductDetail {
  id: number;
  name: string;
  category: string;
  store: {
    id: number;
    name: string;
    address: string;
  };
  originalPrice: number;
  currentPrice: number;
  discountPercent: number;
  hoursRemaining: number;
  expiryDateTime: string;
  expiryBand: "CRITICAL" | "URGENT" | "SOON" | "STANDARD";
  availableQuantity: number;
  nextPriceUpdateAt: string;
  priceHistories: Array<{
    historyId: number;
    price: number;
    calculatedAt: string;
    reason: string | null;
  }>;
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params?.id;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Countdown and next price update minutes
  const [minutesToNextUpdate, setMinutesToNextUpdate] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  }>({ hours: 0, minutes: 0, seconds: 0 });

  // Cart interaction state
  const [cartQty, setCartQty] = useState<number>(1);
  const [addingToCart, setAddingToCart] = useState<boolean>(false);
  const [cartSuccess, setCartSuccess] = useState<{ message: string; correlationId?: string } | null>(null);
  const [cartError, setCartError] = useState<string>("");

  useEffect(() => {
    async function fetchDetails() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/v1/products/${productId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load product details");
        }
        setProduct(data.data);
      } catch (err: any) {
        setError(err.message || "Could not retrieve product");
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      fetchDetails();
    }
  }, [productId]);

  useEffect(() => {
    if (!product) return;

    function updateTimers() {
      if (!product) return;
      const now = Date.now();
      const expiry = new Date(product.expiryDateTime).getTime();
      const diff = Math.max(0, expiry - now);

      const totalSec = Math.floor(diff / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      setTimeLeft({ hours, minutes, seconds });

      // Next price update calculation
      const nextUpdate = new Date(product.nextPriceUpdateAt).getTime();
      const updateDiffMs = Math.max(0, nextUpdate - now);
      const updateMin = Math.ceil(updateDiffMs / (1000 * 60));
      setMinutesToNextUpdate(updateMin);
    }

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [product]);

  if (loading) {
    return (
      <div className="space-y-6">
        <ClockWidget />
        <div className="bg-white p-8 rounded-xl border border-slate-200 animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          <div className="h-10 bg-slate-200 rounded w-1/2"></div>
          <div className="h-20 bg-slate-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <ClockWidget />
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
          <p className="text-sm text-slate-500">{error || "The requested item does not exist or has expired."}</p>
          <Link
            href="/marketplace"
            className="inline-block bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition"
          >
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const bandBadge = {
    CRITICAL: {
      bg: "bg-rose-100 text-rose-800 border-rose-300",
      label: "Critical (0-6h remaining)",
    },
    URGENT: {
      bg: "bg-orange-100 text-orange-800 border-orange-300",
      label: "Urgent (6-24h remaining)",
    },
    SOON: {
      bg: "bg-amber-100 text-amber-800 border-amber-300",
      label: "Soon (1-3 days remaining)",
    },
    STANDARD: {
      bg: "bg-emerald-100 text-emerald-800 border-emerald-300",
      label: "Standard (3+ days remaining)",
    },
  }[product.expiryBand];

  return (
    <div className="space-y-6">
      <ClockWidget />

      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/marketplace" className="hover:text-emerald-700 underline">
          Marketplace
        </Link>
        <span>/</span>
        <span>{product.category}</span>
        <span>/</span>
        <span className="font-semibold text-slate-700 truncate">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Product Details & Purchase Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            {/* Header info */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {product.category}
                </span>
                <h1 className="text-3xl font-extrabold text-slate-800 mt-1">
                  {product.name}
                </h1>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>🏪 Listed by: <strong>{product.store.name}</strong></span>
                  <span>•</span>
                  <span>{product.store.address}</span>
                </p>
              </div>

              {/* Expiry Band Badge */}
              <div className="text-right">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${bandBadge.bg}`}
                >
                  {bandBadge.label}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1 font-mono">
                  {product.hoursRemaining} hours left
                </span>
              </div>
            </div>

            {/* Dynamic Pricing Highlight */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-500 block">
                  Original Listing Price: <del className="font-mono">₹{product.originalPrice}</del>
                </span>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-extrabold text-emerald-800 font-mono">
                    ₹{product.currentPrice}
                  </span>
                  {product.discountPercent > 0 && (
                    <span className="bg-rose-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-md shadow-sm">
                      -{product.discountPercent}% OFF
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-700 mt-1.5 font-medium">
                  Dynamic Price computed by PricingEngine algorithm
                </p>
              </div>

              {/* Next Price Update Notice */}
              <div className="bg-white/80 backdrop-blur px-4 py-3 rounded-lg border border-emerald-200 text-right">
                <span className="text-[11px] text-slate-500 block uppercase font-semibold">
                  Next Price Update
                </span>
                <span className="text-sm font-bold text-slate-800">
                  in ~{minutesToNextUpdate} minutes
                </span>
                <span className="text-[10px] text-slate-400 block">
                  (Hourly decay recalculation)
                </span>
              </div>
            </div>

            {/* Expiry Countdown & Stock Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                  Live Expiry Countdown
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-800 mt-1 block">
                  {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Exact Expiry: {new Date(product.expiryDateTime).toLocaleString()}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">
                  Inventory Status
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-800 mt-1 block">
                  {product.availableQuantity} Units
                </span>
                <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
                  ✓ Verified in Stock
                </span>
              </div>
            </div>

            {/* Add to Cart Section (Module 2 Part A: Steps 15-19) */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                  <button
                    disabled={addingToCart || cartQty <= 1}
                    onClick={() => setCartQty((q) => Math.max(1, q - 1))}
                    className="px-3.5 py-2.5 text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition font-bold"
                  >
                    -
                  </button>
                  <span className="px-4 py-2.5 text-sm font-bold text-slate-900 font-mono bg-white">
                    {cartQty}
                  </span>
                  <button
                    disabled={addingToCart || cartQty >= product.availableQuantity}
                    onClick={() => setCartQty((q) => Math.min(product.availableQuantity, q + 1))}
                    className="px-3.5 py-2.5 text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition font-bold"
                  >
                    +
                  </button>
                </div>

                <button
                  disabled={addingToCart || product.availableQuantity <= 0}
                  onClick={async () => {
                    try {
                      setAddingToCart(true);
                      setCartError("");
                      setCartSuccess(null);
                      const res = await fetch("/api/v1/cart/items", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          productId: product.id,
                          quantity: cartQty,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        if (res.status === 401) {
                          setCartError("Please log in as a Customer to add items to cart.");
                        } else {
                          setCartError(data.error || "Failed to add to cart");
                        }
                      } else {
                        setCartSuccess({
                          message: `Added ${cartQty} unit(s) to cart with 15-minute price hold lock!`,
                          correlationId: data.data?.correlationId,
                        });
                      }
                    } catch (err: any) {
                      setCartError(err.message || "Network error");
                    } finally {
                      setAddingToCart(false);
                    }
                  }}
                  className="flex-1 py-3 px-6 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {addingToCart ? (
                    <span>Adding...</span>
                  ) : (
                    <>
                      <span>🛒 Add to Cart</span>
                      <span className="text-xs font-mono font-normal">
                        (₹{product.currentPrice * cartQty})
                      </span>
                    </>
                  )}
                </button>
              </div>

              {cartSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>✓</span> {cartSuccess.message}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/cart"
                      className="bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg hover:bg-emerald-800 transition"
                    >
                      View Cart →
                    </Link>
                  </div>
                </div>
              )}

              {cartError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
                  <span>⚠️ {cartError}</span>
                  {cartError.includes("log in") && (
                    <Link href="/login" className="font-bold underline">
                      Login Now →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Real Price History Table */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Real Price History
                </h3>
                <p className="text-[11px] text-slate-400">
                  SRS extension: PriceHistory table
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                {product.priceHistories.length} entries
              </span>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {product.priceHistories.map((entry, idx) => (
                <div
                  key={entry.historyId}
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                    idx === 0
                      ? "bg-emerald-50/60 border-emerald-200"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        ₹{entry.price}
                      </span>
                      {idx === 0 && (
                        <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded font-semibold">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {new Date(entry.calculatedAt).toLocaleTimeString()} •{" "}
                      {new Date(entry.calculatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-[10px] text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded">
                      {entry.reason || "DECAY"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
