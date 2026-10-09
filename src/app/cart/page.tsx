"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ClockWidget from "@/components/ClockWidget";

interface CartStoreItem {
  cartItemId: number;
  productId: number;
  name: string;
  category: string;
  originalPrice: number;
  lockedPrice: number;
  latestEnginePrice: number;
  hasPriceChanged: boolean;
  quantity: number;
  subtotal: number;
  availableStock: number;
  priceHoldExpiresAt: string;
  isHoldExpired: boolean;
  holdRemainingSeconds: number;
  store: {
    id: number;
    name: string;
    address: string;
  };
}

interface StoreGroup {
  storeId: number;
  storeName: string;
  storeAddress: string;
  items: CartStoreItem[];
  subtotal: number;
}

interface CartData {
  cartId: number;
  customerId: number;
  totalAmount: number;
  totalSavings: number;
  itemCount: number;
  items: CartStoreItem[];
  stores: StoreGroup[];
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Local ticker for live second-by-second countdown
  const [tick, setTick] = useState<number>(0);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "UPI" | "WALLET">("CARD");
  const [cardNumber, setCardNumber] = useState<string>("4111 1111 1111 1111");
  const [cardholderName, setCardholderName] = useState<string>("John Doe");
  const [cardExpiry, setCardExpiry] = useState<string>("12/28");
  const [cardCvv, setCardCvv] = useState<string>("123");
  const [upiId, setUpiId] = useState<string>("customer@okaxis");
  const [walletName, setWalletName] = useState<string>("PayTM");

  // Price change confirmation state
  const [priceWarning, setPriceWarning] = useState<any[] | null>(null);

  // Checkout Result State
  const [checkoutResult, setCheckoutResult] = useState<{
    success: boolean;
    orders?: any[];
    payment?: any;
    error?: string;
    correlationId?: string;
  } | null>(null);

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/v1/cart");
      if (res.status === 401) {
        router.push("/login?redirect=/cart");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load shopping cart");
      }
      setCart(data.data);
    } catch (err: any) {
      setError(err.message || "Failed to load cart");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Live countdown timer ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleUpdateQuantity = async (cartItemId: number, newQty: number) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/cart/items/${cartItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update quantity");
      } else {
        await fetchCart();
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveItem = async (cartItemId: number) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/cart/items/${cartItemId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to remove item");
      } else {
        await fetchCart();
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyPreset = (type: "SUCCESS" | "FAILURE") => {
    if (type === "SUCCESS") {
      setCardNumber("4111 1111 1111 1111");
      setCardholderName("John Doe");
      setCardExpiry("12/28");
      setCardCvv("123");
    } else {
      setCardNumber("4000 0000 0000 0000");
      setCardholderName("FAIL TEST");
      setCardExpiry("12/28");
      setCardCvv("000");
    }
  };

  const handleExecuteCheckout = async (confirmPriceChanges = false) => {
    try {
      setActionLoading(true);
      setPriceWarning(null);

      const payload: any = {
        paymentMethod,
        confirmPriceChanges,
      };

      if (paymentMethod === "CARD") {
        payload.cardDetails = {
          cardNumber,
          cardholderName,
          expiry: cardExpiry,
          cvv: cardCvv,
        };
      } else if (paymentMethod === "UPI") {
        payload.upiId = upiId;
      } else if (paymentMethod === "WALLET") {
        payload.walletName = walletName;
      }

      const res = await fetch("/api/v1/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409 && data.priceChanged) {
        // Customer must confirm price changes
        setPriceWarning(data.priceChangedItems || []);
        return;
      }

      if (!res.ok) {
        setCheckoutResult({
          success: false,
          error: data.error || "Checkout transaction failed",
          correlationId: data.correlationId,
        });
        setIsCheckoutOpen(false);
        await fetchCart();
        return;
      }

      // Success!
      setCheckoutResult({
        success: true,
        orders: data.data.orders,
        payment: data.data.payment,
        correlationId: data.data.correlationId,
      });
      setIsCheckoutOpen(false);
      await fetchCart();
    } catch (err: any) {
      setCheckoutResult({
        success: false,
        error: err.message || "An unexpected error occurred during checkout",
      });
      setIsCheckoutOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !cart) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 mt-4">Loading your shopping cart...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <ClockWidget />

      {/* Checkout Result Banner (Success or Failure) */}
      {checkoutResult && (
        <div
          className={`p-6 rounded-2xl border shadow-lg transition animate-in fade-in ${
            checkoutResult.success
              ? "bg-gradient-to-r from-emerald-900 to-teal-900 text-white border-emerald-500"
              : "bg-gradient-to-r from-rose-950 to-slate-900 text-white border-rose-500"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 bg-white/10">
                {checkoutResult.success ? "✅ Sequence Steps 20-31 Complete" : "⚠️ Sequence Steps 41-45 Triggered"}
              </div>
              <h2 className="text-2xl font-black">
                {checkoutResult.success
                  ? "Orders Confirmed & Payment Received!"
                  : "Payment Failed • Stock Safely Rolled Back"}
              </h2>
              <p className="text-sm text-slate-200 mt-1 max-w-2xl">
                {checkoutResult.success
                  ? `Your order has been split per store and confirmed. Inventory was reduced, and the cart was cleared.`
                  : checkoutResult.error}
              </p>
              {checkoutResult.success && checkoutResult.orders && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {checkoutResult.orders.map((ord: any) => (
                    <span
                      key={ord.orderId}
                      className="text-xs font-mono font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-2.5 py-1 rounded-md"
                    >
                      {ord.orderNumber} (₹{ord.totalAmount})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {checkoutResult.correlationId && (
                <Link
                  href={`/trace?id=${checkoutResult.correlationId}`}
                  className="bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs px-4 py-2.5 rounded-xl shadow transition"
                >
                  🔍 View Sequence Trace →
                </Link>
              )}
              {checkoutResult.success ? (
                <Link
                  href="/customer/dashboard"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition"
                >
                  My Orders Portal →
                </Link>
              ) : (
                <button
                  onClick={() => setCheckoutResult(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition"
                >
                  Dismiss Alert
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-1">
            <span>🛡️</span> 15-Minute Dynamic Price Lock Guard Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Shopping Cart ({cart?.itemCount || 0} items)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Multi-store grocery cart. Prices are locked for 15 minutes upon adding.
          </p>
        </div>

        <Link
          href="/marketplace"
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
        >
          ← Continue Browsing Marketplace
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Empty Cart View */}
      {cart && cart.items.length === 0 && !checkoutResult && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="text-5xl mb-4">🛒</div>
          <h3 className="text-xl font-bold text-slate-800">Your Cart is Empty</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Rescue near-expiry food and save up to 80% with our hourly decay pricing engine.
          </p>
          <Link
            href="/marketplace"
            className="mt-6 inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md transition"
          >
            Explore Zero-Waste Marketplace →
          </Link>
        </div>
      )}

      {/* Cart Content: Multi-Store Grouping */}
      {cart && cart.items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Cart Items Column */}
          <div className="lg:col-span-2 space-y-6">
            {cart.stores.map((store) => (
              <div
                key={store.storeId}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Store Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏪</span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        {store.storeName}
                      </h3>
                      <p className="text-[11px] text-slate-500">{store.storeAddress}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    Subtotal: ₹{store.subtotal}
                  </span>
                </div>

                {/* Items in this Store */}
                <div className="divide-y divide-slate-100">
                  {store.items.map((item) => {
                    const expiry = new Date(item.priceHoldExpiresAt).getTime();
                    const now = Date.now();
                    const diffSec = Math.max(0, Math.floor((expiry - now) / 1000));
                    const min = Math.floor(diffSec / 60);
                    const sec = diffSec % 60;
                    const isExpired = diffSec <= 0;

                    return (
                      <div key={item.cartItemId} className="p-4 sm:p-5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {item.category}
                            </span>
                            <h4 className="text-base font-bold text-slate-900">
                              {item.name}
                            </h4>
                          </div>

                          {/* 15-Minute Price Hold Countdown Indicator */}
                          <div className="text-right flex sm:flex-col items-center sm:items-end justify-between gap-1">
                            <span
                              className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                isExpired
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isExpired ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                                }`}
                              ></span>
                              {isExpired
                                ? "Hold Expired"
                                : `Hold: ${String(min).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`}
                            </span>
                            {item.hasPriceChanged && (
                              <span className="text-[10px] font-bold text-rose-600 block">
                                Engine Price: ₹{item.latestEnginePrice} (Diff: ₹{item.latestEnginePrice - item.lockedPrice})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price & Quantity Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-slate-400 line-through font-mono">
                              ₹{item.originalPrice}
                            </span>
                            <span className="text-xl font-black text-emerald-700 font-mono">
                              ₹{item.lockedPrice}
                            </span>
                            <span className="text-xs text-slate-500">/ unit</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                              <button
                                disabled={actionLoading || item.quantity <= 1}
                                onClick={() =>
                                  handleUpdateQuantity(item.cartItemId, item.quantity - 1)
                                }
                                className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition font-bold"
                              >
                                -
                              </button>
                              <span className="px-3 py-1 text-xs font-bold text-slate-800 font-mono bg-white">
                                {item.quantity}
                              </span>
                              <button
                                disabled={actionLoading || item.quantity >= item.availableStock}
                                onClick={() =>
                                  handleUpdateQuantity(item.cartItemId, item.quantity + 1)
                                }
                                className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition font-bold"
                              >
                                +
                              </button>
                            </div>

                            <button
                              disabled={actionLoading}
                              onClick={() => handleRemoveItem(item.cartItemId)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Order Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Stores involved:</span>
                  <span className="font-bold text-slate-800">{cart.stores.length} store(s)</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Items total count:</span>
                  <span className="font-bold text-slate-800">{cart.itemCount} item(s)</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Zero-waste dynamic savings:</span>
                  <span className="font-bold font-mono">-₹{cart.totalSavings}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                <div>
                  <span className="text-xs text-slate-500 block">Total Payable</span>
                  <span className="text-xs text-emerald-600 font-semibold">Inclusive of all taxes</span>
                </div>
                <span className="text-2xl font-black text-slate-900 font-mono">
                  ₹{cart.totalAmount}
                </span>
              </div>

              <button
                disabled={actionLoading}
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <span>→</span>
              </button>

              <div className="text-[11px] text-slate-400 text-center leading-relaxed">
                Step 20-31: Creates orders per store, reserves stock, and authorizes payment via gateway simulation.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Secure Checkout & Payment</h3>
                <p className="text-xs text-slate-400">Total amount: ₹{cart?.totalAmount}</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Price Warning Dialog if Hold Expired & Prices Changed */}
              {priceWarning && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span>⚠️</span> Notice: Price Updated Since Hold Expired
                  </div>
                  <p className="text-amber-800">
                    The 15-minute price hold for one or more items has expired, and the decay engine has updated their prices:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-amber-950 font-medium">
                    {priceWarning.map((pw: any) => (
                      <li key={pw.productId}>
                        {pw.name}: ₹{pw.oldPrice} → <span className="font-bold">₹{pw.newPrice}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleExecuteCheckout(true)}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
                    >
                      Accept Updated Prices & Pay
                    </button>
                    <button
                      onClick={() => {
                        setPriceWarning(null);
                        setIsCheckoutOpen(false);
                        fetchCart();
                      }}
                      className="bg-white border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs"
                    >
                      Cancel & Review Cart
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CARD", "UPI", "WALLET"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition text-center ${
                        paymentMethod === method
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {method === "CARD" && "💳 Credit / Debit"}
                      {method === "UPI" && "📱 UPI Transfer"}
                      {method === "WALLET" && "👛 Digital Wallet"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Details Form */}
              {paymentMethod === "CARD" && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  {/* Preset Simulation Buttons */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-semibold text-slate-600">Simulate Test Gateways:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset("SUCCESS")}
                        className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold px-2 py-0.5 rounded text-[10px]"
                      >
                        Success Card
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset("FAILURE")}
                        className="bg-rose-100 text-rose-800 hover:bg-rose-200 font-bold px-2 py-0.5 rounded text-[10px]"
                      >
                        Fail Card (Steps 41-45)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="4111 1111 1111 1111"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Card ending in 0000 triggers Step 41-45 failure & stock rollback.
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-slate-600 block mb-1 font-medium">Cardholder Name</label>
                      <input
                        type="text"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Expiry</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === "UPI" && (
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <label className="text-slate-600 block font-medium">Virtual Payment Address (VPA)</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="name@upi"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Use &apos;fail@upi&apos; to trigger simulation failure.
                  </span>
                </div>
              )}

              {paymentMethod === "WALLET" && (
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <label className="text-slate-600 block font-medium">Select Digital Wallet</label>
                  <select
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="PayTM">PayTM Wallet</option>
                    <option value="PhonePe">PhonePe Wallet</option>
                    <option value="AmazonPay">Amazon Pay</option>
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleExecuteCheckout(false)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2"
                >
                  {actionLoading ? "Processing..." : `Pay ₹${cart?.totalAmount}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
