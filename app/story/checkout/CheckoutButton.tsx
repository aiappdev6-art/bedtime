"use client";

import { useState } from "react";

export default function CheckoutButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startPayment() {
    setLoading(true);
    setError(null);
    try {
      // Phase 3 will implement /api/payment/initiate. For now this stub lets
      // us verify the order pipeline end-to-end.
      const res = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start payment");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Payment URL missing from response");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Payment is not wired up yet — Phase 3 will implement MyFatoorah.",
      );
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={startPayment}
        disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-60"
      >
        {loading ? "Redirecting..." : "Pay with MyFatoorah →"}
      </button>
      {error && (
        <div className="mt-3 text-red-600 text-sm text-center bg-red-50 rounded-lg p-3">
          {error}
        </div>
      )}
    </div>
  );
}
