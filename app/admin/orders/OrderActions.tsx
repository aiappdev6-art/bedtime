"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OrderActions({
  orderId,
  status,
  hasPaymentId,
  hasStory,
}: {
  orderId: string;
  status: string;
  hasPaymentId: boolean;
  hasStory: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRefund =
    hasPaymentId && (status === "paid" || status === "consumed");
  const canRetry = status === "consumed" && !hasStory;

  async function refund() {
    const reason = window.prompt("Refund reason (shown in MyFatoorah)?");
    if (reason === null) return; // user cancelled
    if (!confirm(`Refund order ${orderId.slice(0, 8)}? This cannot be undone.`))
      return;
    setBusy("refund");
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setBusy(null);
    }
  }

  async function retry() {
    if (!confirm(`Flip order ${orderId.slice(0, 8)} back to 'paid' so the user can retry generation?`))
      return;
    setBusy("retry");
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  }

  if (!canRefund && !canRetry) {
    return <span className="text-slate-400 text-xs">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {canRetry && (
        <button
          onClick={retry}
          disabled={!!busy}
          className="px-2 py-1 rounded text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
        >
          {busy === "retry" ? "..." : "Retry"}
        </button>
      )}
      {canRefund && (
        <button
          onClick={refund}
          disabled={!!busy}
          className="px-2 py-1 rounded text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
        >
          {busy === "refund" ? "..." : "Refund"}
        </button>
      )}
      {error && (
        <span className="text-[10px] text-red-600 max-w-[140px]">{error}</span>
      )}
    </div>
  );
}
