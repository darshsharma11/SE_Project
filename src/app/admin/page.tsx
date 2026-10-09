"use client";

import React, { useState, useEffect, useCallback } from "react";
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

export default function AdminPortalPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Demo Time Travel State
  const [advanceHours, setAdvanceHours] = useState<string>("5");
  const [timeTravelLoading, setTimeTravelLoading] = useState<boolean>(false);
  const [lastChangedPrices, setLastChangedPrices] = useState<PriceChangeItem[]>([]);
  const [lastExpiredProducts, setLastExpiredProducts] = useState<ExpiredItem[]>([]);
  const [simulatedTime, setSimulatedTime] = useState<string>("");

  // Pricing Job State
  const [pricingJobLoading, setPricingJobLoading] = useState<boolean>(false);

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/v1/admin/stores");
      // If we don't have a separate stores GET route, we can fetch from an internal endpoint or write one.
      // Let's create an endpoint or use an internal query route.
      if (res.ok) {
        const data = await res.json();
        setStores(data.data || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Handle Verify Store
  const handleVerifyStore = async (storeId: number) => {
    try {
      setError("");
      setStatusMsg("");
      const res = await fetch(`/api/v1/admin/stores/${storeId}/verify`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify store");

      setStatusMsg(data.message || `Store #${storeId} verified.`);
      fetchStores();
    } catch (err: any) {
      setError(err.message || "Failed to verify store");
    }
  };

  // Handle Run Pricing Job Now
  const handleRunPricingJob = async () => {
    try {
      setPricingJobLoading(true);
      setError("");
      setStatusMsg("");

      const res = await fetch("/api/v1/admin/jobs/pricing", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run pricing job");

      setStatusMsg(data.message);
      if (data.result) {
        setLastChangedPrices(data.result.updatedProducts || []);
        setLastExpiredProducts(data.result.expiredProducts || []);
      }
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

      // Trigger clock refresh in widget
      window.dispatchEvent(new Event("clock-updated"));
    } catch (err: any) {
      setError(err.message || "Time travel failed");
    } finally {
      setTimeTravelLoading(false);
    }
  };

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
            <h1 className="text-3xl font-extrabold tracking-tight">
              Administrator Controls
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Store verification (BR-1), manual dynamic pricing execution, and demo time-travel simulation.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/trace"
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              Sequence Trace Viewer (1–14) →
            </Link>
            <Link
              href="/marketplace"
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              Open Marketplace →
            </Link>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs rounded-xl">
            {statusMsg}
          </div>
        )}
        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs rounded-xl">
            {error}
          </div>
        )}
      </div>

      {/* TWO PRIMARY INTERACTIVE SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION A: TIME TRAVEL SIMULATION */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                ⏳ Advance Demo Clock
              </h2>
              <p className="text-xs text-slate-500">
                Simulates time passage to demonstrate decay curve and band transitions in viva.
              </p>
            </div>
            <span className="text-[10px] uppercase font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
              Time Machine
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

          {simulatedTime && (
            <div className="p-3 bg-indigo-50 rounded-lg text-xs border border-indigo-100 text-indigo-900">
              <strong>Simulated Time:</strong> {new Date(simulatedTime).toLocaleString()}
            </div>
          )}

          {/* Results of Price Changes */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Prices Changed by Clock Advance ({lastChangedPrices.length})
            </h3>

            {lastChangedPrices.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No prices changed in the last run (products may already be floored or full price).
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {lastChangedPrices.map((cp) => (
                  <div
                    key={cp.productId}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{cp.name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">#{cp.productId}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="line-through text-slate-400">₹{cp.previousPrice}</span>
                      <span className="text-emerald-700 font-extrabold text-sm">₹{cp.newPrice}</span>
                      <span className="text-xs text-rose-600 font-bold">
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

        {/* SECTION B: PRICING JOB TRIGGER */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                ⚙️ Manual Pricing Engine Job
              </h2>
              <p className="text-xs text-slate-500">
                Triggers applyDecayPricing() and updateExpiredProducts() over all ACTIVE products.
              </p>
            </div>
            <span className="text-[10px] uppercase font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
              Scheduler
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            The platform executes an automated in-process hourly scheduler in the background.
            Use this trigger to execute the calculation immediately during evaluations.
          </p>

          <button
            onClick={handleRunPricingJob}
            disabled={pricingJobLoading}
            className="w-full bg-slate-800 hover:bg-emerald-600 text-white font-bold text-xs py-3 px-4 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {pricingJobLoading ? "Executing Pricing Job..." : "⚡ Run Pricing Job Now"}
          </button>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 space-y-1">
            <span className="font-semibold block text-slate-700">Algorithm Flow:</span>
            <span>1. Scans all ACTIVE products</span>
            <br />
            <span>2. Transitions past-expiry items to EXPIRED_REMOVED</span>
            <br />
            <span>3. Calculates discount based on elapsed decay window</span>
            <br />
            <span>4. Enforces 80% maximum cap and minimum price floor</span>
            <br />
            <span>5. Writes PriceHistory rows if price changed</span>
          </div>
        </div>
      </div>

      {/* SECTION C: STORES LIST & VERIFICATION */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              🏪 Registered Stores & Administrator Verification (BR-1)
            </h2>
            <p className="text-xs text-slate-500">
              Stores must be VERIFIED by an administrator before they can add products.
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
                <th className="px-4 py-3 text-left">Address</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Loading stores...
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No stores registered yet.
                  </td>
                </tr>
              ) : (
                stores.map((s) => (
                  <tr key={s.storeId} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-500">#{s.storeId}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.storeName}</td>
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
    </div>
  );
}
