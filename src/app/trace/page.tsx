"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface TraceRecord {
  traceId: number;
  correlationId: string;
  stepNumber: number;
  messageLabel: string;
  fromEntity: string;
  toEntity: string;
  timestamp: string;
  details: string | null;
}

export default function TracePage() {
  const [tracesByFlow, setTracesByFlow] = useState<Record<string, TraceRecord[]>>({});
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);

  const fetchTraces = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/trace");
      const data = await res.json();
      if (data.success) {
        setTracesByFlow(data.grouped || {});
        setTotalCount(data.traces?.length || 0);
        const flowKeys = Object.keys(data.grouped || {});
        const urlId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
        if (urlId && data.grouped?.[urlId]) {
          setSelectedFlow(urlId);
        } else if (flowKeys.length > 0 && !selectedFlow) {
          setSelectedFlow(flowKeys[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load traces", e);
    } finally {
      setLoading(false);
    }
  }, [selectedFlow]);

  useEffect(() => {
    fetchTraces();
    const interval = setInterval(fetchTraces, 5000);
    return () => clearInterval(interval);
  }, [fetchTraces]);

  const flowKeys = Object.keys(tracesByFlow);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl">🔍</span>
              <h1 className="text-2xl font-bold text-slate-900">Sequence Diagram Step Tracer</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live audit verification of Sequence Diagram interactions (Steps 1 through 48) grouped by flow.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md border border-slate-200">
              {totalCount} Total Logged Steps
            </span>
            <button
              onClick={fetchTraces}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-md transition shadow"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading trace records...</div>
        ) : flowKeys.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            <div className="text-3xl mb-2">📜</div>
            <div className="font-semibold text-slate-700">No Sequence Traces Recorded Yet</div>
            <div className="text-xs text-slate-400 mt-1">
              Traces are automatically generated when executing Module 1 (Product & Pricing) and Module 2 (Order & Delivery) flows.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
            {/* Flow List Sidebar */}
            <div className="md:col-span-4 space-y-2 max-h-[600px] overflow-y-auto pr-2 border-r border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Recorded Execution Flows ({flowKeys.length})
              </div>
              {flowKeys.map((key) => {
                const steps = tracesByFlow[key];
                const isSelected = selectedFlow === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedFlow(key)}
                    className={`w-full text-left p-3 rounded-lg border transition text-xs ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="font-mono text-[11px] truncate">{key}</div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span>{steps.length} steps recorded</span>
                      <span>{new Date(steps[0].timestamp).toLocaleTimeString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Trace Timeline View */}
            <div className="md:col-span-8">
              {selectedFlow && tracesByFlow[selectedFlow] ? (
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <div>
                      <div className="text-xs text-slate-400">Viewing Correlation:</div>
                      <div className="font-mono text-sm font-bold text-slate-800">{selectedFlow}</div>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                      {tracesByFlow[selectedFlow].length} steps
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {tracesByFlow[selectedFlow].map((step, idx) => (
                      <div
                        key={step.traceId}
                        className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono font-bold rounded text-[11px]">
                              Step {step.stepNumber}
                            </span>
                            <span className="font-bold text-slate-800 font-mono text-sm">
                              {step.messageLabel}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 mt-2 text-xs">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-semibold rounded text-[11px]">
                            {step.fromEntity}
                          </span>
                          <span className="text-slate-400 font-bold">⟶</span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-semibold rounded text-[11px]">
                            {step.toEntity}
                          </span>
                        </div>

                        {step.details && (
                          <div className="mt-2 text-[11px] font-mono bg-white p-2 rounded border border-slate-200 text-slate-600 whitespace-pre-wrap">
                            {step.details}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Select a flow on the left to inspect its sequence diagram steps.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
