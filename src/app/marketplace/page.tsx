"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ClockWidget from "@/components/ClockWidget";

interface ProductItem {
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
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [correlationId, setCorrelationId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Filters & Search
  const [keyword, setKeyword] = useState<string>("");
  const [category, setCategory] = useState<string>("ALL");
  const [storeFilter, setStoreFilter] = useState<string>("");
  const [bandFilter, setBandFilter] = useState<string>("ALL");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [minDiscount, setMinDiscount] = useState<string>("");
  const [sort, setSort] = useState<string>("discount_desc");

  // Auto-refresh timer countdown (60s)
  const [refreshIn, setRefreshIn] = useState<number>(60);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (keyword.trim()) params.append("keyword", keyword.trim());
      if (category && category !== "ALL") params.append("category", category);
      if (storeFilter.trim()) params.append("store", storeFilter.trim());
      if (bandFilter && bandFilter !== "ALL") params.append("band", bandFilter);
      if (maxPrice && Number(maxPrice) > 0) params.append("maxPrice", maxPrice);
      if (minDiscount && Number(minDiscount) > 0)
        params.append("minDiscount", minDiscount);
      if (sort) params.append("sort", sort);

      const res = await fetch(`/api/v1/marketplace/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch products");
      }

      setProducts(data.data || []);
      setTotal(data.total || 0);
      setCorrelationId(data.correlationId || "");
      setRefreshIn(60);
    } catch (err: any) {
      setError(err.message || "Failed to load marketplace products");
    } finally {
      setLoading(false);
    }
  }, [keyword, category, storeFilter, bandFilter, maxPrice, minDiscount, sort]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Periodic 60-second refresh and 1-second countdown decrement
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshIn((prev) => {
        if (prev <= 1) {
          fetchProducts();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchProducts]);

  return (
    <div className="space-y-6">
      <ClockWidget />

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold mb-3 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Dynamic Hourly Decay Pricing Active
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Zero-Waste Grocery Marketplace
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Fresh food priced according to proximity to expiration. Hourly
              algorithmic price decay prevents food waste while saving you up
              to 80%.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-right">
              <span className="text-[11px] text-slate-300 uppercase tracking-wider block">
                Auto-Refreshing in:
              </span>
              <span className="text-lg font-mono font-bold text-emerald-300">
                {refreshIn}s
              </span>
            </div>
            <button
              onClick={() => fetchProducts()}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition shadow-sm"
            >
              ↻ Refresh Now
            </button>
          </div>
        </div>

        {/* Trace Correlation Banner */}
        {correlationId && (
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-emerald-300">
                Sequence Trace (Steps 1–14):
              </span>
              <code className="bg-black/30 px-2 py-0.5 rounded font-mono text-[11px] text-slate-200">
                {correlationId}
              </code>
            </div>
            <Link
              href={`/trace?id=${correlationId}`}
              className="text-emerald-300 hover:text-emerald-200 underline font-medium"
            >
              View Step-by-Step Viva Trace →
            </Link>
          </div>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Search Products
            </label>
            <input
              type="text"
              placeholder="Search by name (e.g. Milk, Bread, Apples)..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Categories</option>
              <option value="Dairy">Dairy</option>
              <option value="Bakery">Bakery</option>
              <option value="Produce">Produce (Fruits & Veg)</option>
              <option value="Meat & Poultry">Meat & Poultry</option>
              <option value="Packaged Foods">Packaged Foods</option>
              <option value="Beverages">Beverages</option>
            </select>
          </div>

          {/* Expiry Band */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Expiry Band
            </label>
            <select
              value={bandFilter}
              onChange={(e) => setBandFilter(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Bands</option>
              <option value="CRITICAL">🔴 Critical (0–6h remaining)</option>
              <option value="URGENT">🟠 Urgent (6–24h remaining)</option>
              <option value="SOON">🟡 Soon (1–3 days remaining)</option>
              <option value="STANDARD">🟢 Standard (3+ days remaining)</option>
            </select>
          </div>
        </div>

        {/* Secondary Filters & Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Store / Vendor
            </label>
            <input
              type="text"
              placeholder="Store name..."
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Max Price (₹)
            </label>
            <input
              type="number"
              placeholder="e.g. 100"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Min Discount (%)
            </label>
            <input
              type="number"
              placeholder="e.g. 20"
              value={minDiscount}
              onChange={(e) => setMinDiscount(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Sort By
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="discount_desc">Highest Discount First</option>
              <option value="price_asc">Lowest Price First</option>
              <option value="expiry_asc">Nearest Expiry First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-semibold text-slate-700">
          Showing <span className="text-emerald-700 font-bold">{total}</span>{" "}
          Active Products Available
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse space-y-4"
            >
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-6 bg-slate-200 rounded w-3/4"></div>
              <div className="h-8 bg-slate-200 rounded w-1/2"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="text-4xl">🛒</div>
          <h3 className="text-lg font-bold text-slate-800">
            No matching products found
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Try adjusting your search query, price limit, or category filters.
            Only in-stock, verified products with future expiry are displayed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: ProductItem }) {
  // Live countdown client computation
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, isExpired: false });

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setAdding(true);
      const res = await fetch("/api/v1/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      if (res.ok) {
        setAdded(true);
        setTimeout(() => setAdded(false), 2500);
      } else {
        const d = await res.json();
        alert(d.error || "Failed to add to cart (please ensure you are logged in as a customer)");
      }
    } catch {
      alert("Failed to add to cart");
    } finally {
      setAdding(false);
    }
  };

  useEffect(() => {
    function updateCountdown() {
      const expiry = new Date(product.expiryDateTime).getTime();
      const now = Date.now();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [product.expiryDateTime]);

  // Color badges based on Expiry Band
  const bandBadge = {
    CRITICAL: {
      bg: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
      label: "Critical Expiry (0-6h)",
    },
    URGENT: {
      bg: "bg-orange-50 text-orange-700 border-orange-200",
      dot: "bg-orange-500",
      label: "Urgent Expiry (6-24h)",
    },
    SOON: {
      bg: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
      label: "Expiring Soon (1-3d)",
    },
    STANDARD: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
      label: "Standard (3d+)",
    },
  }[product.expiryBand];

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-emerald-400 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden">
      <div className="p-5 space-y-3">
        {/* Category & Expiry Band Badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {product.category}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${bandBadge.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${bandBadge.dot}`}></span>
            {bandBadge.label}
          </span>
        </div>

        {/* Product Title */}
        <div>
          <Link
            href={`/products/${product.id}`}
            className="text-lg font-bold text-slate-800 hover:text-emerald-700 transition line-clamp-1"
          >
            {product.name}
          </Link>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <span>🏪 {product.store.name}</span>
            <span>•</span>
            <span className="truncate">{product.store.address}</span>
          </p>
        </div>

        {/* Pricing Block */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-baseline justify-between">
          <div>
            <span className="text-xs text-slate-400 block line-through font-mono">
              ₹{product.originalPrice}
            </span>
            <span className="text-2xl font-extrabold text-emerald-700 font-mono">
              ₹{product.currentPrice}
            </span>
          </div>

          <div className="text-right">
            {product.discountPercent > 0 ? (
              <span className="inline-block bg-rose-600 text-white font-extrabold text-xs px-2 py-0.5 rounded shadow-sm">
                -{product.discountPercent}% OFF
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-500">
                Full Price
              </span>
            )}
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Decay Engine
            </span>
          </div>
        </div>

        {/* Expiry Countdown & Units Left */}
        <div className="space-y-1.5 pt-1 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span className="font-medium">Live Expiry Timer:</span>
            <span
              className={`font-mono font-bold ${
                timeLeft.isExpired
                  ? "text-rose-600"
                  : timeLeft.hours <= 6
                  ? "text-rose-600 font-extrabold"
                  : "text-slate-800"
              }`}
            >
              {timeLeft.isExpired
                ? "EXPIRED"
                : `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="font-medium">Available Units:</span>
            <span className="font-bold text-slate-700">
              {product.availableQuantity} units left
            </span>
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center gap-2">
        <Link
          href={`/products/${product.id}`}
          className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs py-2 px-2 rounded-lg transition"
        >
          Details →
        </Link>
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={adding || product.availableQuantity <= 0}
          className={`flex-1 text-center font-bold text-xs py-2 px-2 rounded-lg transition shadow-sm ${
            added
              ? "bg-emerald-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          }`}
        >
          {adding ? "Adding..." : added ? "✓ In Cart" : "🛒 + Cart"}
        </button>
      </div>
    </div>
  );
}
