"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ClockWidget from "@/components/ClockWidget";

interface ProductRow {
  productId: number;
  name: string;
  category: string;
  originalPrice: number;
  currentPrice: number;
  expiryDateTime: string;
  status: string;
  pricingRuleId?: number | null;
  inventoryItem?: {
    inventoryId: number;
    quantity: number;
    reservedQuantity: number;
  } | null;
  pricingRule?: {
    ruleId: number;
    discountRate: number;
    expiryThresholdHours: number;
    maximumDiscount: number;
    minimumPriceFloor: number;
  } | null;
}

interface PricingRuleItem {
  ruleId: number;
  discountRate: number;
  expiryThresholdHours: number;
  maximumDiscount: number;
  minimumPriceFloor: number;
  category: string | null;
}

interface PricePreviewPoint {
  hoursRemaining: number;
  discountPercent: number;
  price: number;
  isFloored: boolean;
  isCapped: boolean;
  band: string;
}

export default function StorePortalPage() {
  const [activeTab, setActiveTab] = useState<"PRODUCTS" | "RULES">("PRODUCTS");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [rules, setRules] = useState<PricingRuleItem[]>([]);
  const [storeInfo, setStoreInfo] = useState<{
    storeId: number;
    storeName: string;
    status: string;
    address?: string;
  } | null>(null);
  const [availableStores, setAvailableStores] = useState<
    Array<{ storeId: number; storeName: string; status: string }>
  >([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<{
    totalProducts: number;
    totalInventory: number;
    nearExpiryCount: number;
    totalOrders: number;
    pendingOrders: number;
    storeRevenue: number;
  } | null>(null);
  const [switchingOwner, setSwitchingOwner] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Modal State for Create / Edit Product
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  // Product Form Fields
  const [formName, setFormName] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("Dairy");
  const [formOriginalPrice, setFormOriginalPrice] = useState<string>("60");
  const [formQuantity, setFormQuantity] = useState<string>("10");
  const [formExpiry, setFormExpiry] = useState<string>("");
  const [formRuleId, setFormRuleId] = useState<string>("");

  // Price Preview State
  const [pricePreview, setPricePreview] = useState<PricePreviewPoint[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Pricing Rule Form Fields (for Rules Tab)
  const [ruleDiscountRate, setRuleDiscountRate] = useState<string>("0.05");
  const [ruleThreshold, setRuleThreshold] = useState<string>("24");
  const [ruleMaxDiscount, setRuleMaxDiscount] = useState<string>("0.80");
  const [rulePriceFloor, setRulePriceFloor] = useState<string>("10");
  const [ruleCategory, setRuleCategory] = useState<string>("");
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);

  // Load Data
  const loadData = useCallback(async (overrideStoreId?: number) => {
    try {
      setLoading(true);
      setError("");

      const targetStoreId = overrideStoreId ?? selectedStoreId;
      const storeQuery = targetStoreId ? `?storeId=${targetStoreId}` : "";

      const [prodRes, ruleRes] = await Promise.all([
        fetch(`/api/v1/store/products${storeQuery}`),
        fetch(`/api/v1/store/pricing-rules${storeQuery}`),
      ]);

      if (prodRes.status === 401) {
        setError("Please log in as a STORE_OWNER to access this portal.");
        setLoading(false);
        return;
      }

      const prodData = await prodRes.json();
      const ruleData = await ruleRes.json();

      if (!prodRes.ok) throw new Error(prodData.error || "Failed to load products");
      if (!ruleRes.ok) throw new Error(ruleData.error || "Failed to load pricing rules");

      setProducts(prodData.data || []);
      setStoreInfo(prodData.store || null);
      if (prodData.store) {
        setSelectedStoreId(prodData.store.storeId);
      }
      setAvailableStores(prodData.stores || []);
      setAnalytics(prodData.analytics || null);
      setRules(ruleData.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load store data");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Evaluator switcher between seeded store owners
  const handleSwitchStoreOwner = async (ownerEmail: string) => {
    try {
      setSwitchingOwner(ownerEmail);
      const res = await fetch("/api/v1/auth/demo-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "STORE_OWNER", email: ownerEmail }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Force page reload to reinitialize navigation and store state cleanly
      window.location.reload();
    } catch (e: any) {
      alert(`Failed to switch store owner: ${e.message}`);
      setSwitchingOwner(null);
    }
  };

  // Set default expiry to +12 hours from now
  const setDefaultExpiry = () => {
    const future = new Date(Date.now() + 12 * 3600 * 1000);
    // format as YYYY-MM-DDTHH:mm
    const iso = future.toISOString();
    setFormExpiry(iso.substring(0, 16));
  };

  // Open Create Product Modal
  const openCreateModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormCategory("Dairy");
    setFormOriginalPrice("60");
    setFormQuantity("10");
    setDefaultExpiry();
    if (rules.length > 0) {
      setFormRuleId(String(rules[0].ruleId));
    }
    setShowProductModal(true);
    fetchPricePreview(60, rules[0]?.ruleId);
  };

  // Open Edit Product Modal
  const openEditModal = (p: ProductRow) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormOriginalPrice(String(p.originalPrice));
    setFormQuantity(String(p.inventoryItem?.quantity ?? 1));
    const expiry = new Date(p.expiryDateTime);
    setFormExpiry(expiry.toISOString().substring(0, 16));
    setFormRuleId(p.pricingRuleId ? String(p.pricingRuleId) : "");
    setShowProductModal(true);
    fetchPricePreview(p.originalPrice, p.pricingRuleId ?? undefined);
  };

  // Fetch Server-Driven Price Preview
  const fetchPricePreview = async (origPrice: number, rId?: number) => {
    try {
      setPreviewLoading(true);
      const selectedRule = rules.find((r) => r.ruleId === Number(rId)) || rules[0];
      const res = await fetch("/api/v1/pricing/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPrice: origPrice || 100,
          discountRate: selectedRule?.discountRate ?? 0.05,
          expiryThresholdHours: selectedRule?.expiryThresholdHours ?? 24,
          maximumDiscount: selectedRule?.maximumDiscount ?? 0.80,
          minimumPriceFloor: selectedRule?.minimumPriceFloor ?? 5,
        }),
      });
      const data = await res.json();
      if (res.ok && data.preview) {
        setPricePreview(data.preview);
      }
    } catch (err) {
      console.error("Preview fetch error:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle Product Save (Create or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      setSuccessMsg("");

      const payload = {
        name: formName,
        category: formCategory,
        originalPrice: Number(formOriginalPrice),
        quantity: Number(formQuantity),
        expiryDateTime: new Date(formExpiry).toISOString(),
        pricingRuleId: formRuleId ? Number(formRuleId) : null,
      };

      if (editingProduct) {
        // PATCH
        const res = await fetch(`/api/v1/store/products/${editingProduct.productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update product");
        setSuccessMsg(`Product '${data.data.name}' updated and price recalculated immediately!`);
      } else {
        // POST
        const res = await fetch("/api/v1/store/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create product");
        setSuccessMsg(`Product '${data.data.name}' listed successfully with decay pricing!`);
      }

      setShowProductModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    }
  };

  // Handle Deactivate Product
  const handleDeactivate = async (productId: number) => {
    if (!confirm("Are you sure you want to deactivate and remove this product?")) return;
    try {
      const res = await fetch(`/api/v1/store/products/${productId}/deactivate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to deactivate");
      setSuccessMsg("Product transitioned to MANUALLY_REMOVED.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to deactivate product");
    }
  };

  // Handle Save Pricing Rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      setSuccessMsg("");

      const payload = {
        ruleId: editingRuleId ?? undefined,
        discountRate: Number(ruleDiscountRate),
        expiryThresholdHours: Number(ruleThreshold),
        maximumDiscount: Number(ruleMaxDiscount),
        minimumPriceFloor: Number(rulePriceFloor),
        category: ruleCategory || null,
      };

      const res = await fetch("/api/v1/store/pricing-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save rule");

      setSuccessMsg(
        `Pricing Rule saved. ${data.recalculatedProductsCount || 0} active products recalculated immediately.`
      );
      setEditingRuleId(null);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save pricing rule");
    }
  };

  // Calculate Product Counts Per Band (BR-5)
  const bandCounts = { CRITICAL: 0, URGENT: 0, SOON: 0, STANDARD: 0 };
  const nowMs = Date.now();
  products.forEach((p) => {
    if (p.status !== "ACTIVE") return;
    const diffHours = (new Date(p.expiryDateTime).getTime() - nowMs) / (1000 * 3600);
    if (diffHours <= 6) bandCounts.CRITICAL++;
    else if (diffHours <= 24) bandCounts.URGENT++;
    else if (diffHours <= 72) bandCounts.SOON++;
    else bandCounts.STANDARD++;
  });

  if (error && !storeInfo) {
    return (
      <div className="space-y-6">
        <ClockWidget />
        <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center shadow-sm space-y-4">
          <div className="text-4xl">🏪</div>
          <h2 className="text-xl font-bold text-slate-800">Store Owner Access Required</h2>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ClockWidget />

      {/* Store Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {/* Evaluator Store Owner Switcher Bar */}
        <div className="p-3.5 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-amber-400 uppercase tracking-wider text-[11px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
              Evaluator Store Switcher
            </span>
            <span className="text-slate-300">
              Switch between seeded store owners to inspect different stores:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={switchingOwner !== null}
              onClick={() => handleSwitchStoreOwner("freshmart.owner@gmail.com")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                storeInfo?.storeName?.includes("FreshMart")
                  ? "bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-300"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              🏪 FreshMart (Ramesh)
            </button>
            <button
              type="button"
              disabled={switchingOwner !== null}
              onClick={() => handleSwitchStoreOwner("greenleaf.owner@gmail.com")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                storeInfo?.storeName?.includes("GreenLeaf")
                  ? "bg-emerald-500 text-slate-950 font-bold ring-2 ring-emerald-300"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              🌿 GreenLeaf (Priya)
            </button>
            <button
              type="button"
              disabled={switchingOwner !== null}
              onClick={() => handleSwitchStoreOwner("cornermart.owner@gmail.com")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                storeInfo?.storeName?.includes("Corner")
                  ? "bg-purple-500 text-slate-950 font-bold ring-2 ring-purple-300"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              🏬 CornerMart (Devendra - Pending)
            </button>
          </div>
        </div>

        {/* Store Title & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded font-bold">
                Store ID: #{storeInfo?.storeId ?? "—"}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase ${
                  storeInfo?.status === "VERIFIED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {storeInfo?.status === "VERIFIED"
                  ? "✓ Verified Store (BR-1)"
                  : "⚠ " + (storeInfo?.status || "Pending Verification")}
              </span>

              {/* Multi-Store Selector (if owner manages more than 1 store) */}
              {availableStores.length > 1 && (
                <div className="flex items-center gap-1.5 ml-2">
                  <label htmlFor="store-select" className="text-xs font-semibold text-slate-500">
                    Switch Store:
                  </label>
                  <select
                    id="store-select"
                    value={selectedStoreId ?? ""}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setSelectedStoreId(id);
                      loadData(id);
                    }}
                    className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500"
                  >
                    {availableStores.map((s) => (
                      <option key={s.storeId} value={s.storeId}>
                        {s.storeName} (#{s.storeId}) - {s.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">
              {storeInfo?.storeName || "My Store Dashboard"}
            </h1>
            {storeInfo?.address && (
              <p className="text-xs text-slate-500 mt-1 font-mono">
                📍 {storeInfo.address}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/store/orders"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200 transition"
            >
              📋 Manage Orders
            </Link>
            <button
              onClick={openCreateModal}
              disabled={storeInfo?.status !== "VERIFIED"}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm ${
                storeInfo?.status === "VERIFIED"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              + List New Near-Expiry Product
            </button>
          </div>
        </div>

        {/* Store Analytics Cards */}
        {analytics && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                📊 Store Performance & Inventory Analytics
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 block">Total Listed</span>
                <span className="text-xl font-black text-slate-800 mt-0.5 block">
                  {analytics.totalProducts}
                </span>
                <span className="text-[10px] text-slate-400">Active catalog items</span>
              </div>
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                <span className="text-[11px] font-semibold text-blue-700 block">Available Stock</span>
                <span className="text-xl font-black text-blue-900 mt-0.5 block">
                  {analytics.totalInventory}
                </span>
                <span className="text-[10px] text-blue-600">Units in inventory</span>
              </div>
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                <span className="text-[11px] font-semibold text-amber-700 block">Near Expiry (&lt;24h)</span>
                <span className="text-xl font-black text-amber-900 mt-0.5 block">
                  {analytics.nearExpiryCount}
                </span>
                <span className="text-[10px] text-amber-600">Urgent & critical decay</span>
              </div>
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
                <span className="text-[11px] font-semibold text-purple-700 block">Store Orders</span>
                <span className="text-xl font-black text-purple-900 mt-0.5 block">
                  {analytics.totalOrders}
                </span>
                <span className="text-[10px] text-purple-600">
                  {analytics.pendingOrders > 0 ? `${analytics.pendingOrders} awaiting action` : "All processed"}
                </span>
              </div>
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-emerald-700 block">Store Revenue</span>
                <span className="text-xl font-black text-emerald-900 mt-0.5 block">
                  ₹{analytics.storeRevenue}
                </span>
                <span className="text-[10px] text-emerald-600">Confirmed & delivered</span>
              </div>
            </div>
          </div>
        )}

        {/* Alert / Feedback messages */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs">
            {successMsg}
          </div>
        )}

        {/* Band Counts Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">
              🔴 Critical Band (0–6h)
            </span>
            <span className="text-2xl font-extrabold text-rose-900 mt-1 block">
              {bandCounts.CRITICAL}
            </span>
            <span className="text-[11px] text-rose-600">Immediate decay focus</span>
          </div>

          <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-xl">
            <span className="text-xs font-bold text-orange-700 uppercase tracking-wider block">
              🟠 Urgent Band (6–24h)
            </span>
            <span className="text-2xl font-extrabold text-orange-900 mt-1 block">
              {bandCounts.URGENT}
            </span>
            <span className="text-[11px] text-orange-600">Active discount ramp</span>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
              🟡 Soon Band (1–3 days)
            </span>
            <span className="text-2xl font-extrabold text-amber-900 mt-1 block">
              {bandCounts.SOON}
            </span>
            <span className="text-[11px] text-amber-600">Entering decay threshold</span>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
              🟢 Standard (3+ days)
            </span>
            <span className="text-2xl font-extrabold text-emerald-900 mt-1 block">
              {bandCounts.STANDARD}
            </span>
            <span className="text-[11px] text-emerald-600">Normal full shelf price</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-4 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("PRODUCTS")}
          className={`pb-2 px-1 border-b-2 transition ${
            activeTab === "PRODUCTS"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Manage Store Products ({products.length})
        </button>
        <button
          onClick={() => setActiveTab("RULES")}
          className={`pb-2 px-1 border-b-2 transition ${
            activeTab === "RULES"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Pricing Rules Configuration ({rules.length})
        </button>
      </div>

      {/* TAB 1: PRODUCTS TABLE */}
      {activeTab === "PRODUCTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Original Price</th>
                  <th className="px-4 py-3 text-left">Current Price</th>
                  <th className="px-4 py-3 text-left">Price Floor</th>
                  <th className="px-4 py-3 text-left">Stock (Qty)</th>
                  <th className="px-4 py-3 text-left">Expiry & Band</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {products.map((p) => {
                  const expiryDate = new Date(p.expiryDateTime);
                  const hoursLeft = Math.max(
                    0,
                    Number(((expiryDate.getTime() - nowMs) / (1000 * 3600)).toFixed(1))
                  );
                  const isExpired = expiryDate.getTime() <= nowMs;
                  const floorPrice = p.pricingRule?.minimumPriceFloor ?? 1;

                  return (
                    <tr key={p.productId} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <Link
                          href={`/products/${p.productId}`}
                          className="hover:text-emerald-700 hover:underline"
                        >
                          {p.name}
                        </Link>
                        <span className="block font-mono text-[10px] text-slate-400">
                          #{p.productId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">₹{p.originalPrice}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-700 text-sm">
                        ₹{p.currentPrice}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">₹{floorPrice}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {p.inventoryItem?.quantity ?? 0}
                        {p.inventoryItem?.reservedQuantity
                          ? ` (${p.inventoryItem.reservedQuantity} res)`
                          : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-medium text-slate-800">
                          {expiryDate.toLocaleDateString()}{" "}
                          {expiryDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span
                          className={`inline-block text-[10px] font-bold mt-0.5 ${
                            isExpired
                              ? "text-rose-600"
                              : hoursLeft <= 6
                              ? "text-rose-600 font-extrabold"
                              : hoursLeft <= 24
                              ? "text-orange-600"
                              : "text-slate-500"
                          }`}
                        >
                          {isExpired ? "EXPIRED" : `(${hoursLeft}h left)`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.status === "EXPIRED_REMOVED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {p.status === "ACTIVE" && (
                          <>
                            <button
                              onClick={() => openEditModal(p)}
                              className="text-emerald-700 hover:text-emerald-900 font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeactivate(p.productId)}
                              className="text-rose-600 hover:text-rose-800 font-semibold"
                            >
                              Deactivate
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRICING RULES CONFIG */}
      {activeTab === "RULES" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800">Active Pricing Decay Rules</h2>
            <p className="text-xs text-slate-500">
              Pricing formula: Discount% = min(discountRate × hoursElapsedInWindow, maximumDiscount, 80%).
              Price = max(originalPrice × (1 - discount%), minimumPriceFloor).
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2 text-left">Rule ID</th>
                    <th className="px-3 py-2 text-left">Threshold (Window)</th>
                    <th className="px-3 py-2 text-left">Decay Rate</th>
                    <th className="px-3 py-2 text-left">Max Discount</th>
                    <th className="px-3 py-2 text-left">Price Floor</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rules.map((r) => (
                    <tr key={r.ruleId}>
                      <td className="px-3 py-2 font-mono font-bold text-slate-700">#{r.ruleId}</td>
                      <td className="px-3 py-2">{r.expiryThresholdHours} hours</td>
                      <td className="px-3 py-2 font-mono text-emerald-700 font-semibold">
                        {(r.discountRate * 100).toFixed(1)}% / hour
                      </td>
                      <td className="px-3 py-2 font-mono text-rose-700 font-semibold">
                        {(r.maximumDiscount * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 font-mono">₹{r.minimumPriceFloor}</td>
                      <td className="px-3 py-2 text-slate-600">{r.category || "All"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => {
                            setEditingRuleId(r.ruleId);
                            setRuleDiscountRate(String(r.discountRate));
                            setRuleThreshold(String(r.expiryThresholdHours));
                            setRuleMaxDiscount(String(r.maximumDiscount));
                            setRulePriceFloor(String(r.minimumPriceFloor));
                            setRuleCategory(r.category || "");
                          }}
                          className="text-emerald-700 hover:text-emerald-900 font-semibold"
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit / Create Rule Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              {editingRuleId ? `Configure Rule #${editingRuleId}` : "Create New Pricing Rule"}
            </h3>
            <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Decay Rate (per hour in decay window)
                </label>
                <input
                  type="number"
                  step="0.005"
                  max="1.0"
                  value={ruleDiscountRate}
                  onChange={(e) => setRuleDiscountRate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                  required
                />
                <span className="text-[10px] text-slate-400">e.g. 0.05 for 5% per hour decay</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Expiry Threshold Hours
                </label>
                <input
                  type="number"
                  value={ruleThreshold}
                  onChange={(e) => setRuleThreshold(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                  required
                />
                <span className="text-[10px] text-slate-400">Decay starts when hours remaining &le; threshold</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Maximum Discount Cap (Max 0.80)
                </label>
                <input
                  type="number"
                  step="0.05"
                  max="0.80"
                  value={ruleMaxDiscount}
                  onChange={(e) => setRuleMaxDiscount(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Minimum Price Floor (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={rulePriceFloor}
                  onChange={(e) => setRulePriceFloor(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Category (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dairy, Bakery"
                  value={ruleCategory}
                  onChange={(e) => setRuleCategory(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded transition"
                >
                  Save & Immediately Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PRODUCT MODAL WITH SERVER-DRIVEN PRICE PREVIEW */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800">
                {editingProduct ? `Edit Product #${editingProduct.productId}` : "List New Near-Expiry Product"}
              </h2>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Organic Whole Milk 1L"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="Dairy">Dairy</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Produce">Produce</option>
                    <option value="Meat & Poultry">Meat & Poultry</option>
                    <option value="Packaged Foods">Packaged Foods</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formOriginalPrice}
                    onChange={(e) => {
                      setFormOriginalPrice(e.target.value);
                      fetchPricePreview(Number(e.target.value), Number(formRuleId));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Expiry Date & Time (Must be in future)
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Pricing Rule</label>
                  <select
                    value={formRuleId}
                    onChange={(e) => {
                      setFormRuleId(e.target.value);
                      fetchPricePreview(Number(formOriginalPrice), Number(e.target.value));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {rules.map((r) => (
                      <option key={r.ruleId} value={r.ruleId}>
                        Rule #{r.ruleId} ({r.expiryThresholdHours}h threshold, {(r.discountRate * 100).toFixed(0)}%/h, max {(r.maximumDiscount * 100).toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SERVER-DRIVEN PRICE PREVIEW TABLE */}
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    📈 Dynamic Decay Price Preview (Server Engine)
                  </span>
                  {previewLoading && (
                    <span className="text-[11px] text-slate-400 animate-pulse">Calculating...</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Simulated prices as hours remaining decrease towards expiration:
                </p>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-[11px] divide-y divide-slate-200">
                    <thead>
                      <tr className="text-slate-500 text-left">
                        <th className="py-1">Hours Remaining</th>
                        <th className="py-1">Expiry Band</th>
                        <th className="py-1">Discount %</th>
                        <th className="py-1 font-mono">Calculated Price</th>
                        <th className="py-1">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {pricePreview.map((pt) => (
                        <tr key={pt.hoursRemaining}>
                          <td className="py-1 font-mono font-semibold">{pt.hoursRemaining}h remaining</td>
                          <td className="py-1">
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-700">
                              {pt.band}
                            </span>
                          </td>
                          <td className="py-1 font-bold text-rose-600">{pt.discountPercent}% OFF</td>
                          <td className="py-1 font-mono font-extrabold text-emerald-700 text-xs">
                            ₹{pt.price}
                          </td>
                          <td className="py-1 text-[10px] text-slate-400">
                            {pt.isFloored ? "Price Floor Hit" : pt.isCapped ? "Max 80% Cap" : "Decaying"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition"
                >
                  {editingProduct ? "Save Changes & Recalculate" : "List Product on Marketplace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
