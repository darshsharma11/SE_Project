"use client";

import React, { useEffect, useState } from "react";

export default function ClockWidget() {
  const [time, setTime] = useState<string>("");
  const [offsetHours, setOffsetHours] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchClock = async () => {
    try {
      const res = await fetch("/api/v1/clock");
      const data = await res.json();
      setTime(new Date(data.now).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
      setOffsetHours(Math.round(data.offsetMs / (1000 * 3600)));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchClock();
    const interval = setInterval(fetchClock, 10000);
    return () => clearInterval(interval);
  }, []);

  const advanceHours = async (hours: number) => {
    setLoading(true);
    await fetch("/api/v1/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance", hours }),
    });
    await fetchClock();
    setLoading(false);
  };

  const resetClock = async () => {
    setLoading(true);
    await fetch("/api/v1/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    await fetchClock();
    setLoading(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-md text-lg">⏰</div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Simulated System Clock (IST)
          </div>
          <div className="text-base font-bold text-slate-800 font-mono">
            {time || "Loading..."}
            {offsetHours !== 0 && (
              <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                +{offsetHours}h offset
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => advanceHours(1)}
          disabled={loading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded border border-slate-300 transition"
        >
          +1 Hour
        </button>
        <button
          onClick={() => advanceHours(6)}
          disabled={loading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded border border-slate-300 transition"
        >
          +6 Hours
        </button>
        <button
          onClick={() => advanceHours(24)}
          disabled={loading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded border border-slate-300 transition"
        >
          +24 Hours
        </button>
        {offsetHours !== 0 && (
          <button
            onClick={resetClock}
            disabled={loading}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium px-2.5 py-1.5 rounded border border-rose-200 transition"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
