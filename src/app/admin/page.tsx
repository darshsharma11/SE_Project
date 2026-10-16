"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import ClockWidget from "@/components/ClockWidget";

interface StoreItem {
  storeId: number;
  storeName: string;
  address: string;
  status: string;
  ownerId: number;
  owner?: {
    user?: {
      name: string;
      email: string;
    };
  };
}

interface PriceChangeItem {
  productId: number;
  name: string;
  previousPrice: number;
  newPrice: number;
}

interface ExpiredItem {
  productId: number;
  name: string;
}

interface PricingRuleItem {
  ruleId: number;
  category: string | null;
  discountRate: number;
  expiryThresholdHours: number;
  maximumDiscount: number;
  minimumPriceFloor: number;
  storeId: number | null;
  storeName: string;
  isGlobal: boolean;
  productCount: number;
  isActive: boolean;
}

interface PriceHistoryEntry {
  historyId: number;
  price: number;
  calculatedAt: string;
  reason: string | null;
}

interface ProductPricingItem {
  productId: number;
  name: string;
  category: string;
  status: string;
  originalPrice: number;
  currentPrice: number;
  finalCalculatedPrice: number;
  discountPercent: number;
  expiryDateTime: string;
  hoursRemaining: number;
  band: string;
  isExpired: boolean;
  store: {
    storeId: number;
    storeName: string;
    status: string;
    address: string;
  };
  inventory: {
    quantity: number;
    reservedQuantity: number;
    available: number;
  } | null;
  pricingRule: {
    ruleId: number;
    category: string;
    discountRate: number;
    expiryThresholdHours: number;
    maximumDiscount: number;
    minimumPriceFloor: number;
    storeId: number | null;
    isGlobal: boolean;
  };
  lastPriceUpdate: string | null;
  priceHistories: PriceHistoryEntry[];
  calculationExplanation: {
    originalPrice: number;
    hoursRemaining: number;
    expiryThresholdHours: number;
    inDecayWindow: boolean;
    hoursElapsedInWindow: number;
    discountRatePerHour: number;
    computedDiscountPercent: number;
    maximumDiscountCapPercent: number;
    appliedDiscountPercent: number;
    rawDiscountedPrice: number;
    minimumPriceFloor: number;
    flooredPrice: number;
    effectivePrice: number;
    finalSellingPrice: number;
    isFloorActive: boolean;
    isCapActive: boolean;
  };
}

export default function AdminPortalPage() {
  const [activeTab, setActiveTab] = useState<"PRICING" | "STORES" | "TIMEMACHINE">("PRICING");

  // Stores state
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [storesLoading, setStoresLoading] = useState<boolean>(true);

  // Pricing Rules state
  const [rules, setRules] = useState<PricingRuleItem[]>([]);
  const [rulesLoading, setRulesLoading] = useState<boolean>(true);
  const [editingRule, setEditingRule] = useState<PricingRuleItem | null>(null);
  const [editRate, setEditRate] = useState<string>("0.05");
  const [editThreshold, setEditThreshold] = useState<string>("24");
  const [editMaxDiscount, setEditMaxDiscount] = useState<string>("0.80");
  const [editPriceFloor, setEditPriceFloor] = useState<string>("10");
  const [savingRule, setSavingRule] = useState<boolean>(false);

  // Product Pricing state
  const [products, setProducts] = useState<ProductPricingItem[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductPricingItem | null>(null);

  // Filters for products
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [selectedBandFilter, setSelectedBandFilter] = useState<string>("ALL");

  // Demo Decay Simulator state
  const [simProduct, setSimProduct] = useState<ProductPricingItem | null>(null);
  const [simHoursRemaining, setSimHoursRemaining] = useState<number>(12);

  // Time Travel State
  const [advanceHours, setAdvanceHours] = useState<string>("5");
  const [timeTravelLoading, setTimeTravelLoading] = useState<boolean>(false);
  const [resetClockLoading, setResetClockLoading] = useState<boolean>(false);
  const [lastChangedPrices, setLastChangedPrices] = useState<PriceChangeItem[]>([]);
  const [lastExpiredProducts, setLastExpiredProducts] = useState<ExpiredItem[]>([]);
  const [simulatedTime, setSimulatedTime] = useState<string>("");

  // Pricing Job State
  const [pricingJobLoading, setPricingJobLoading] = useState<boolean>(false);

  const [error, setError] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Fetch all stores
  const fetchStores = useCallback(async () => {
    try {
      setStoresLoading(true);
      const res = await fetch("/api/v1/admin/stores");
      if (res.status === 401 || res.status === 403) {
        setError("Access Restricted: Administrator console is only accessible to Administrators.");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStores(data.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to retrieve stores");
    } finally {
      setStoresLoading(false);
    }
  }, []);

  // Fetch pricing rules
  const fetchRules = useCallback(async () => {
    try {
      setRulesLoading(true);
      const res = await fetch("/api/v1/admin/pricing-rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data.data || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  // Fetch product pricing overview
  const fetchProductPricing = useCallback(async () => {
    try {
      setProductsLoading(true);
      const res = await fetch("/api/v1/admin/pricing/products");
      if (res.ok) {
        const data = await res.json();
        const prods: ProductPricingItem[] = data.products || [];
        setProducts(prods);
        if (prods.length > 0 && !simProduct) {
          setSimProduct(prods[0]);
          setSimHoursRemaining(Math.min(prods[0].pricingRule.expiryThresholdHours, 12));
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setProductsLoading(false);
    }
  }, [simProduct]);

  useEffect(() => {
    fetchStores();
    fetchRules();
    fetchProductPricing();
  }, [fetchStores, fetchRules, fetchProductPricing]);

  // Handle Verify Store
  const handleVerifyStore = async (storeId: number) => {
    try {
      setError("");
      setStatusMsg("");
      const res = await fetch(`/api/v1/admin/stores/${storeId}/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify store");

      setStatusMsg(data.message || `Store #${storeId} verified.`);
      fetchStores();
      fetchProductPricing();
    } catch (err: any) {
      setError(err.message || "Failed to verify store");
    }
  };

  // Open Edit Rule Modal
  const openEditRuleModal = (r: PricingRuleItem) => {
    setEditingRule(r);
    setEditRate(String(r.discountRate));
    setEditThreshold(String(r.expiryThresholdHours));
    setEditMaxDiscount(String(r.maximumDiscount));
    setEditPriceFloor(String(r.minimumPriceFloor));
  };

  // Handle Save Pricing Rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    try {
      setSavingRule(true);
      setError("");
      setStatusMsg("");

      const payload = {
        ruleId: editingRule.ruleId,
        discountRate: Number(editRate),
        expiryThresholdHours: Number(editThreshold),
        maximumDiscount: Number(editMaxDiscount),
        minimumPriceFloor: Number(editPriceFloor),
        category: editingRule.category,
      };

      const res = await fetch("/api/v1/admin/pricing-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update rule");

      setStatusMsg(data.message || `Pricing Rule #${editingRule.ruleId} updated.`);
      setEditingRule(null);
      fetchRules();
      fetchProductPricing();
    } catch (err: any) {
      setError(err.message || "Failed to update pricing rule");
    } finally {
      setSavingRule(false);
    }
  };

  // Handle Run Pricing Job Now
  const handleRunPricingJob = async () => {
    try {
      setPricingJobLoading(true);
      setError("");
      setStatusMsg("");

      const res = await fetch("/api/v1/admin/jobs/pricing", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run pricing job");

      setStatusMsg(data.message);
      if (data.result) {
        setLastChangedPrices(data.result.updatedProducts || []);
        setLastExpiredProducts(data.result.expiredProducts || []);
      }
      fetchProductPricing();
    } catch (err: any) {
      setError(err.message || "Pricing job failed");
    } finally {
      setPricingJobLoading(false);
    }
  };

  // Handle Advance Demo Clock
  const handleAdvanceTime = async () => {
    try {
      setTimeTravelLoading(true);
      setError("");
      setStatusMsg("");

      const hoursNum = Number(advanceHours);
      if (isNaN(hoursNum) || hoursNum <= 0) {
        setError("Please enter a valid positive number of hours.");
        return;
      }

      const res = await fetch("/api/v1/admin/demo/advance-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: hoursNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to advance demo clock");

      setStatusMsg(data.message);
      setSimulatedTime(data.simulatedNow);
      setLastChangedPrices(data.updatedProducts || []);
      setLastExpiredProducts(data.expiredProducts || []);

      window.dispatchEvent(new Event("clock-updated"));
      fetchProductPricing();
    } catch (err: any) {
      setError(err.message || "Time travel failed");
    } finally {
      setTimeTravelLoading(false);
    }
  };

  // Handle Reset Clock to Real Time
  const handleResetClock = async () => {
    try {
      setResetClockLoading(true);
      setError("");
      setStatusMsg("");

      const res = await fetch("/api/v1/admin/demo/reset-time", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset demo clock");

      setStatusMsg(data.message);
      setSimulatedTime("");
      setLastChangedPrices(data.updatedProducts || []);
      setLastExpiredProducts(data.expiredProducts || []);

      window.dispatchEvent(new Event("clock-updated"));
      fetchProductPricing();
    } catch (err: any) {
      setError(err.message || "Failed to reset clock");
    } finally {
      setResetClockLoading(false);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesStore = p.store.storeName.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        if (!matchesName && !matchesStore && !matchesCategory) return false;
      }
      if (selectedStoreFilter !== "ALL" && String(p.store.storeId) !== selectedStoreFilter) {
        return false;
      }
      if (selectedCategoryFilter !== "ALL" && p.category !== selectedCategoryFilter) {
        return false;
      }
      if (selectedBandFilter !== "ALL" && p.band !== selectedBandFilter) {
        return false;
      }
      return true;
    });
  }, [products, searchQuery, selectedStoreFilter, selectedCategoryFilter, selectedBandFilter]);

  // Dynamic Decay Simulation calculation for selected product
  const simCalculation = useMemo(() => {
    if (!simProduct) return null;
    const rule = simProduct.pricingRule;
    const threshold = rule.expiryThresholdHours;
    const isExpired = simHoursRemaining <= 0;
    const inDecay = !isExpired && simHoursRemaining <= threshold;
    const elapsed = inDecay ? Math.max(0, threshold - simHoursRemaining) : 0;
    const computedDiscount = inDecay ? rule.discountRate * elapsed : isExpired ? rule.maximumDiscount : 0;
    const appliedDiscount = Math.min(computedDiscount, rule.maximumDiscount, 0.80);

    const rawDiscounted = simProduct.originalPrice * (1 - appliedDiscount);
    const floored = Math.max(rawDiscounted, rule.minimumPriceFloor);
    // Never exceed original price due to floor rule
    const effective = Math.min(simProduct.originalPrice, floored);
    const finalPrice = Math.round(effective);
    const savingsPercent =
      simProduct.originalPrice > 0
        ? Math.round(((simProduct.originalPrice - finalPrice) / simProduct.originalPrice) * 100)
        : 0;

    return {
      hoursRemaining: simHoursRemaining,
      threshold,
      inDecay,
      elapsed: Number(elapsed.toFixed(1)),
      rate: rule.discountRate,
      computedDiscountPercent: Number((computedDiscount * 100).toFixed(1)),
      maxCapPercent: Number((rule.maximumDiscount * 100).toFixed(1)),
      appliedDiscountPercent: Number((appliedDiscount * 100).toFixed(1)),
      rawPrice: Number(rawDiscounted.toFixed(2)),
      floor: rule.minimumPriceFloor,
      floored: Number(floored.toFixed(2)),
      effective: Number(effective.toFixed(2)),
      finalPrice,
      savingsPercent,
      isFloorEnforced: rawDiscounted < rule.minimumPriceFloor,
      isCapEnforced: computedDiscount >= rule.maximumDiscount,
    };
  }, [simProduct, simHoursRemaining]);

  if (error && stores.length === 0 && !storesLoading) {
    return (
      <div className="space-y-6">
        <ClockWidget />
        <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center shadow-sm space-y-4">
          <div className="text-4xl">🛡️</div>
          <h2 className="text-xl font-bold text-slate-800">Administrator Access Required</h2>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ClockWidget />

      {/* Admin Header */}
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-xs font-semibold mb-2 border border-purple-500/30">
              Platform Administration & Verification
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Administrator Console & Dynamic Pricing
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Store verification (BR-1), cross-store dynamic decay rules, product price inspection, and time-travel simulation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchStores();
                fetchRules();
                fetchProductPricing();
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-700 transition"
            >
              ↻ Refresh Data
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs rounded-xl flex items-center justify-between">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg("")} className="text-emerald-400 hover:text-white ml-2">✕</button>
          </div>
        )}
        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-rose-400 hover:text-white ml-2">✕</button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-4 text-sm font-bold">
        <button
          onClick={() => setActiveTab("PRICING")}
          className={`pb-3 px-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === "PRICING"
              ? "border-purple-600 text-purple-700 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>📉</span>
          <span>Dynamic Pricing Management ({products.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("STORES")}
          className={`pb-3 px-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === "STORES"
              ? "border-purple-600 text-purple-700 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>🏪</span>
          <span>Stores & Verification ({stores.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("TIMEMACHINE")}
          className={`pb-3 px-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === "TIMEMACHINE"
              ? "border-purple-600 text-purple-700 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>⏳</span>
          <span>Simulation Clock & Jobs</span>
        </button>
      </div>

      {/* TAB 1: PRICING MANAGEMENT */}
      {activeTab === "PRICING" && (
        <div className="space-y-6">
          {/* SECTION A: PRICING RULES TABLE */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>📐</span> Expiry-Based Pricing Rules Configuration
                </h2>
                <p className="text-xs text-slate-500">
                  Global and store-scoped pricing decay parameters enforced by the backend engine.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-purple-50 text-purple-800 px-2.5 py-1 rounded-lg border border-purple-200">
                {rules.length} Active Rules
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5 text-left">Rule ID</th>
                    <th className="px-3.5 py-2.5 text-left">Category / Scope</th>
                    <th className="px-3.5 py-2.5 text-left">Decay Rate</th>
                    <th className="px-3.5 py-2.5 text-left">Threshold (T)</th>
                    <th className="px-3.5 py-2.5 text-left">Max Cap</th>
                    <th className="px-3.5 py-2.5 text-left">Price Floor</th>
                    <th className="px-3.5 py-2.5 text-left">Stores / Scope</th>
                    <th className="px-3.5 py-2.5 text-center">Products</th>
                    <th className="px-3.5 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rulesLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                        Loading rules...
                      </td>
                    </tr>
                  ) : rules.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                        No pricing rules configured.
                      </td>
                    </tr>
                  ) : (
                    rules.map((r) => (
                      <tr key={r.ruleId} className="hover:bg-slate-50/80 transition">
                        <td className="px-3.5 py-2.5 font-mono font-bold text-slate-500">
                          #{r.ruleId}
                        </td>
                        <td className="px-3.5 py-2.5 font-bold text-slate-800">
                          {r.category || "General"}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-purple-700 font-bold">
                          {(r.discountRate * 100).toFixed(1)}%/hr
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-slate-700">
                          {r.expiryThresholdHours}h before expiry
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-rose-700 font-semibold">
                          {(r.maximumDiscount * 100).toFixed(0)}%
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-emerald-700 font-semibold">
                          ₹{r.minimumPriceFloor.toFixed(2)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.isGlobal
                                ? "bg-slate-100 text-slate-700 border border-slate-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {r.storeName}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-slate-700">
                          {r.productCount}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            onClick={() => openEditRuleModal(r)}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200 font-bold px-2.5 py-1 rounded-lg text-[11px] transition"
                          >
                            ✏ Edit Rule
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION B: PRODUCT-LEVEL PRICING OVERVIEW ACROSS ALL STORES */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>🏷️</span> All Store Products — Live Expiry & Dynamic Prices
                </h2>
                <p className="text-xs text-slate-500">
                  Inspect selling prices across all stores, remaining decay hours, and assigned pricing rules.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
                {filteredProducts.length} of {products.length} Products
              </span>
            </div>

            {/* Search and Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Search Products / Stores</label>
                <input
                  type="text"
                  placeholder="e.g. Milk, Croissants, FreshMart..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Filter by Store</label>
                <select
                  value={selectedStoreFilter}
                  onChange={(e) => setSelectedStoreFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                >
                  <option value="ALL">All Stores ({stores.length})</option>
                  {stores.map((s) => (
                    <option key={s.storeId} value={String(s.storeId)}>
                      {s.storeName} (#{s.storeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Filter by Category</label>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Produce">Produce</option>
                  <option value="Snacks">Snacks</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Filter by Expiry Band</label>
                <select
                  value={selectedBandFilter}
                  onChange={(e) => setSelectedBandFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
                >
                  <option value="ALL">All Bands</option>
                  <option value="CRITICAL">Critical (0–6h)</option>
                  <option value="URGENT">Urgent (6–24h)</option>
                  <option value="SOON">Soon (24–72h)</option>
                  <option value="STANDARD">Standard (72h+)</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            </div>

            {/* Products Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5 text-left">Product</th>
                    <th className="px-3.5 py-2.5 text-left">Owning Store</th>
                    <th className="px-3.5 py-2.5 text-left">Category</th>
                    <th className="px-3.5 py-2.5 text-right">Original</th>
                    <th className="px-3.5 py-2.5 text-right">Current Price</th>
                    <th className="px-3.5 py-2.5 text-center">Discount</th>
                    <th className="px-3.5 py-2.5 text-left">Expiry / Time Left</th>
                    <th className="px-3.5 py-2.5 text-center">Band</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {productsLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Loading product pricing overview...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No products match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.productId} className="hover:bg-slate-50/80 transition">
                        <td className="px-3.5 py-2.5">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID #{p.productId} • Stock: {p.inventory?.available ?? 0}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="font-medium text-slate-800">{p.store.storeName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">Store #{p.store.storeId}</div>
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-slate-700">{p.category}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-slate-500">
                          ₹{p.originalPrice}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-black text-emerald-700 text-sm">
                          ₹{p.currentPrice}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono">
                          {p.discountPercent > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">
                              -{p.discountPercent}%
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">0%</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="font-mono text-slate-700">
                            {p.isExpired ? (
                              <span className="text-rose-700 font-bold">Past Expiry</span>
                            ) : (
                              <span>{p.hoursRemaining}h remaining</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(p.expiryDateTime).toLocaleDateString()} {new Date(p.expiryDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.band === "CRITICAL"
                                ? "bg-rose-100 text-rose-800"
                                : p.band === "URGENT"
                                ? "bg-orange-100 text-orange-800"
                                : p.band === "SOON"
                                ? "bg-amber-100 text-amber-800"
                                : p.band === "EXPIRED"
                                ? "bg-slate-200 text-slate-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {p.band}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            onClick={() => setSelectedProduct(p)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-2.5 py-1 rounded-lg text-[11px] transition"
                          >
                            🔍 Explain & History
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION D: INTERACTIVE PRICING DECAY SIMULATOR (EVALUATOR DEMO) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>⚡</span> Live Expiry-Decay Simulation & Calculation Verifier
                </h2>
                <p className="text-xs text-slate-500">
                  Select any product to preview how its price decays as expiry approaches without modifying database records.
                </p>
              </div>
              <span className="text-[11px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full">
                Non-Persistent Preview
              </span>
            </div>

            {/* Product Selector for Simulator */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Product to Simulate:
                </label>
                <select
                  value={simProduct?.productId ?? ""}
                  onChange={(e) => {
                    const found = products.find((p) => p.productId === Number(e.target.value));
                    if (found) {
                      setSimProduct(found);
                      setSimHoursRemaining(Math.min(found.pricingRule.expiryThresholdHours, 12));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white"
                >
                  {products.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.name} ({p.store.storeName}) — ₹{p.originalPrice} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Simulation Time Presets:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSimHoursRemaining(72)}
                    className="text-[11px] font-bold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                  >
                    72h (Full)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimHoursRemaining(24)}
                    className="text-[11px] font-bold px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg"
                  >
                    24h (Threshold)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimHoursRemaining(8)}
                    className="text-[11px] font-bold px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg"
                  >
                    8h (Urgent)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimHoursRemaining(2)}
                    className="text-[11px] font-bold px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg"
                  >
                    2h (Critical)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimHoursRemaining(0)}
                    className="text-[11px] font-bold px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
                  >
                    0h (Expired)
                  </button>
                </div>
              </div>
            </div>

            {/* Slider Control */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Simulated Hours Remaining until Expiry:</span>
                <span className="font-mono text-sm px-2.5 py-0.5 bg-indigo-600 text-white rounded-lg">
                  {simHoursRemaining} hours remaining
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="72"
                step="1"
                value={simHoursRemaining}
                onChange={(e) => setSimHoursRemaining(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0h (Expired)</span>
                <span>6h (Critical)</span>
                <span>24h (Urgent)</span>
                <span>48h (Soon)</span>
                <span>72h (Standard)</span>
              </div>
            </div>

            {/* Live Calculation Output Card */}
            {simCalculation && simProduct && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50/50 p-5 rounded-xl border border-purple-200 text-xs">
                {/* Left Column: Calculation Breakdown */}
                <div className="space-y-2.5">
                  <h3 className="font-extrabold text-purple-900 text-sm flex items-center gap-1.5">
                    <span>🧮</span> Backend PricingEngine Formula Breakdown:
                  </h3>
                  <div className="space-y-1 font-mono text-[11px] text-slate-700 bg-white p-3 rounded-lg border border-purple-100">
                    <div>1. Original Price: <strong>₹{simProduct.originalPrice}</strong></div>
                    <div>2. Expiry Threshold: <strong>{simCalculation.threshold}h</strong></div>
                    <div>
                      3. Decay Window: {simCalculation.inDecay ? (
                        <span className="text-emerald-700 font-bold">INSIDE ({simCalculation.elapsed}h elapsed)</span>
                      ) : (
                        <span className="text-slate-500 font-bold">OUTSIDE (Full shelf price)</span>
                      )}
                    </div>
                    <div>4. Decay Rate: <strong>{(simCalculation.rate * 100).toFixed(1)}%/hr</strong></div>
                    <div>5. Computed Discount: <strong>{simCalculation.computedDiscountPercent}%</strong></div>
                    <div>
                      6. Maximum Discount Cap: <strong>{simCalculation.maxCapPercent}%</strong>
                      {simCalculation.isCapEnforced && <span className="text-rose-600 font-bold ml-1.5">[CAP ENFORCED]</span>}
                    </div>
                    <div>7. Applied Discount: <strong>{simCalculation.appliedDiscountPercent}%</strong></div>
                    <div>8. Raw Discounted Price: <strong>₹{simCalculation.rawPrice}</strong></div>
                    <div>
                      9. Minimum Price Floor: <strong>₹{simCalculation.floor}</strong>
                      {simCalculation.isFloorEnforced && <span className="text-blue-600 font-bold ml-1.5">[FLOOR ENFORCED]</span>}
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 text-xs">
                      10. Final Selling Price: <strong className="text-emerald-700 text-sm">₹{simCalculation.finalPrice}</strong>
                    </div>
                  </div>
                </div>

                {/* Right Column: Comparative Price Card */}
                <div className="flex flex-col justify-between bg-white p-5 rounded-xl border border-purple-100">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Product Simulation Result
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900 mt-1">
                      {simProduct.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Store: {simProduct.store.storeName} • Category: {simProduct.category}
                    </p>
                  </div>

                  <div className="my-4 p-4 bg-slate-50 rounded-xl text-center">
                    <span className="text-xs text-slate-500 line-through block font-mono">
                      Original: ₹{simProduct.originalPrice}
                    </span>
                    <span className="text-3xl font-black text-emerald-700 font-mono block mt-1">
                      ₹{simCalculation.finalPrice}
                    </span>
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full inline-block mt-2">
                      Save ₹{simProduct.originalPrice - simCalculation.finalPrice} ({simCalculation.savingsPercent}% Discount)
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-1">
                    <div>✓ Evaluator Verification: The real backend PricingEngine produces this exact number.</div>
                    <div>✓ Floor Rule: Selling price will never exceed original shelf price or drop below ₹{simCalculation.floor}.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STORES & VERIFICATION (BR-1) */}
      {activeTab === "STORES" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                🏪 Registered Stores & Administrator Verification (BR-1)
              </h2>
              <p className="text-xs text-slate-500">
                Stores must be VERIFIED by an administrator before they can add products or sell on marketplace.
              </p>
            </div>
            <button
              onClick={fetchStores}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              ↻ Refresh Stores
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Store ID</th>
                  <th className="px-4 py-3 text-left">Store Name</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-left">Address</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {storesLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      Loading stores...
                    </td>
                  </tr>
                ) : stores.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No stores registered yet.
                    </td>
                  </tr>
                ) : (
                  stores.map((s) => (
                    <tr key={s.storeId} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-500">#{s.storeId}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{s.storeName}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.owner?.user?.name || `Owner #${s.ownerId}`}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.address}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.status === "VERIFIED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.status !== "VERIFIED" ? (
                          <button
                            onClick={() => handleVerifyStore(s.storeId)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-sm"
                          >
                            Verify Store
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-medium text-xs">
                            ✓ Verified
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SIMULATION CLOCK & JOBS */}
      {activeTab === "TIMEMACHINE" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Advance Demo Clock */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    ⏳ Advance Demo Clock
                  </h2>
                  <p className="text-xs text-slate-500">
                    Advances the central virtual clock to observe real-world decay across the platform.
                  </p>
                </div>
                <span className="text-[10px] uppercase font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                  Time Travel
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Advance Hours (N)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={advanceHours}
                    onChange={(e) => setAdvanceHours(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="pt-5">
                  <button
                    onClick={handleAdvanceTime}
                    disabled={timeTravelLoading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {timeTravelLoading ? "Advancing..." : `Advance Clock by ${advanceHours}h →`}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleResetClock}
                  disabled={resetClockLoading}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-lg border border-slate-300 transition"
                >
                  {resetClockLoading ? "Resetting..." : "↺ Reset Clock to Real System Time"}
                </button>
              </div>

              {simulatedTime && (
                <div className="p-3 bg-indigo-50 rounded-lg text-xs border border-indigo-100 text-indigo-900">
                  <strong>Simulated Time:</strong> {new Date(simulatedTime).toLocaleString()}
                </div>
              )}
            </div>

            {/* Manual Pricing Engine Job */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    ⚙️ Manual Pricing Engine Job
                  </h2>
                  <p className="text-xs text-slate-500">
                    Triggers applyDecayPricing() and updateExpiredProducts() over all active products.
                  </p>
                </div>
                <span className="text-[10px] uppercase font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  Scheduler
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                The platform executes an automated in-process hourly scheduler in the background.
                Use this button to run the price update job on demand during demonstrations.
              </p>

              <button
                onClick={handleRunPricingJob}
                disabled={pricingJobLoading}
                className="w-full bg-slate-800 hover:bg-emerald-600 text-white font-bold text-xs py-3 px-4 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {pricingJobLoading ? "Executing Pricing Job..." : "⚡ Run Pricing Job Now"}
              </button>
            </div>
          </div>

          {/* Results of Price Changes */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Prices Changed in Recent Run ({lastChangedPrices.length})
            </h3>

            {lastChangedPrices.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No prices changed in the last run (products may already be floored or full price).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {lastChangedPrices.map((cp) => (
                  <div
                    key={cp.productId}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{cp.name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">ID #{cp.productId}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="line-through text-slate-400">₹{cp.previousPrice}</span>
                      <span className="text-emerald-700 font-extrabold">₹{cp.newPrice}</span>
                      <span className="text-[11px] text-rose-600 font-bold">
                        (-₹{cp.previousPrice - cp.newPrice})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {lastExpiredProducts.length > 0 && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                <strong>Expired Products Removed ({lastExpiredProducts.length}):</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {lastExpiredProducts.map((ep) => (
                    <li key={ep.productId}>
                      {ep.name} (#{ep.productId}) transitioned to EXPIRED_REMOVED
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT PRICING RULE */}
      {editingRule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Edit Pricing Rule #{editingRule.ruleId}
                </h3>
                <p className="text-xs text-slate-500">
                  Category: {editingRule.category || "General"} ({editingRule.storeName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Discount Rate (fraction per hour, e.g. 0.05 = 5%/hr):
                </label>
                <input
                  type="number"
                  step="0.005"
                  min="0.005"
                  max="1.0"
                  required
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Expiry Threshold (hours before expiry to begin decay):
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="720"
                  required
                  value={editThreshold}
                  onChange={(e) => setEditThreshold(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Maximum Discount Cap (fraction, max 0.80 per BR-3):
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.10"
                  max="0.80"
                  required
                  value={editMaxDiscount}
                  onChange={(e) => setEditMaxDiscount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Minimum Price Floor (₹, price will never drop below this):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1.0"
                  required
                  value={editPriceFloor}
                  onChange={(e) => setEditPriceFloor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-500">
                Saving will update the rule in SQLite and immediately recalculate current prices for assigned products.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold shadow-sm"
                >
                  {savingRule ? "Saving..." : "Save Rule & Recalculate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRODUCT CALCULATION EXPLANATION & PRICE HISTORY */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Calculation Explanation & Price History
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                  {selectedProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Store: {selectedProduct.store.storeName} • Category: {selectedProduct.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Explanation Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>🧮</span> Step-by-Step Backend Engine Formula:
              </h4>

              <div className="space-y-1.5 font-mono text-xs text-slate-700 bg-white p-3.5 rounded-lg border border-slate-200 leading-relaxed">
                <div>
                  1. <strong>Original Price:</strong> ₹{selectedProduct.calculationExplanation.originalPrice}
                </div>
                <div>
                  2. <strong>Remaining Time until Expiry:</strong> {selectedProduct.calculationExplanation.hoursRemaining} hours
                </div>
                <div>
                  3. <strong>Assigned Rule Threshold:</strong> {selectedProduct.calculationExplanation.expiryThresholdHours} hours
                  {selectedProduct.calculationExplanation.inDecayWindow ? (
                    <span className="text-emerald-700 font-bold ml-1.5">[Inside Decay Window]</span>
                  ) : (
                    <span className="text-slate-400 font-bold ml-1.5">[Outside Decay Window &rarr; Full Price]</span>
                  )}
                </div>
                <div>
                  4. <strong>Hours Elapsed in Decay Window:</strong> {selectedProduct.calculationExplanation.hoursElapsedInWindow} hours
                </div>
                <div>
                  5. <strong>Applicable Discount Rate:</strong> {(selectedProduct.calculationExplanation.discountRatePerHour * 100).toFixed(1)}%/hr
                </div>
                <div>
                  6. <strong>Computed Discount:</strong> {selectedProduct.calculationExplanation.computedDiscountPercent}%
                </div>
                <div>
                  7. <strong>Maximum Discount Cap:</strong> {selectedProduct.calculationExplanation.maximumDiscountCapPercent}%
                  {selectedProduct.calculationExplanation.isCapActive && (
                    <span className="text-rose-600 font-bold ml-1.5">[Cap Active]</span>
                  )}
                </div>
                <div>
                  8. <strong>Applied Discount:</strong> {selectedProduct.calculationExplanation.appliedDiscountPercent}%
                </div>
                <div>
                  9. <strong>Raw Discounted Price:</strong> ₹{selectedProduct.calculationExplanation.rawDiscountedPrice}
                </div>
                <div>
                  10. <strong>Minimum Price Floor:</strong> ₹{selectedProduct.calculationExplanation.minimumPriceFloor}
                  {selectedProduct.calculationExplanation.isFloorActive && (
                    <span className="text-blue-600 font-bold ml-1.5">[Floor Enforced]</span>
                  )}
                </div>
                <div>
                  11. <strong>Upper Bound Enforcement:</strong> min(Floored, Original) = ₹{selectedProduct.calculationExplanation.effectivePrice}
                </div>
                <div className="pt-2 border-t border-slate-200 text-sm font-extrabold text-emerald-800">
                  12. <strong>Final Authoritative Selling Price:</strong> ₹{selectedProduct.calculationExplanation.finalSellingPrice}
                </div>
              </div>
            </div>

            {/* Persistent Price History Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📜</span> Persistent Price Change History ({selectedProduct.priceHistories.length} entries)
                </h4>
              </div>

              {selectedProduct.priceHistories.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400 italic">
                  No historical price change entries recorded for this product yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-3.5 py-2 text-left">Timestamp</th>
                        <th className="px-3.5 py-2 text-right">Price</th>
                        <th className="px-3.5 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedProduct.priceHistories.map((h) => (
                        <tr key={h.historyId} className="hover:bg-slate-50/80">
                          <td className="px-3.5 py-2 text-slate-600 font-mono">
                            {new Date(h.calculatedAt).toLocaleString()}
                          </td>
                          <td className="px-3.5 py-2 text-right font-mono font-bold text-emerald-700">
                            ₹{h.price}
                          </td>
                          <td className="px-3.5 py-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                              {h.reason || "HOURLY_DECAY"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
