"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthChip from "../AuthChip";
import { formatKwd } from "@/lib/pricing";

type Order = {
  id: string;
  storyId: string | null;
  amountKwd: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  title: string | null;
  voice: boolean;
  characterImage: boolean;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orders/mine")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setOrders(data.orders);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-700">
          Your Orders
        </h1>
        <div className="flex items-center gap-3">
          <AuthChip />
          <Link
            href="/"
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-xl font-semibold shadow hover:shadow-lg transition"
          >
            + New Story
          </Link>
        </div>
      </header>

      {error && (
        <div className="max-w-4xl mx-auto text-red-600 bg-red-50 rounded-lg p-4">
          {error}
        </div>
      )}

      {!orders && !error && (
        <p className="max-w-4xl mx-auto text-amber-700">Loading...</p>
      )}

      {orders && orders.length === 0 && (
        <div className="max-w-4xl mx-auto text-center text-gray-500 mt-16">
          No orders yet. Create your first story!
        </div>
      )}

      {orders && orders.length > 0 && (
        <ul className="max-w-4xl mx-auto space-y-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </ul>
      )}
    </main>
  );
}

function OrderCard({ order }: { order: Order }) {
  const date = new Date(order.createdAt).toLocaleString();

  return (
    <li className="bg-white rounded-2xl border-2 border-amber-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="font-bold text-amber-800 truncate">
            {order.title ?? "Untitled"}
          </h2>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {date} · #{order.id.slice(0, 8)}
        </p>
        <div className="flex gap-3 text-xs text-gray-600 mt-2">
          {order.voice && <span>🔊 Voice</span>}
          {order.characterImage && <span>👤 Custom character</span>}
          {!order.voice && !order.characterImage && (
            <span className="text-gray-400">Base story</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-stretch sm:items-end gap-2">
        <div className="font-mono font-bold text-amber-700">
          {formatKwd(order.amountKwd)}
        </div>
        <OrderActions order={order} />
      </div>
    </li>
  );
}

function OrderActions({ order }: { order: Order }) {
  // Map order state → CTAs.
  if (order.status === "pending") {
    return (
      <Link
        href={`/story/checkout?orderId=${order.id}`}
        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold text-center"
      >
        Pay now →
      </Link>
    );
  }
  if (order.status === "paid") {
    return (
      <Link
        href={`/story/generating?orderId=${order.id}`}
        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold text-center"
      >
        Generate →
      </Link>
    );
  }
  if (order.status === "consumed" && order.storyId) {
    return (
      <div className="flex gap-2">
        <Link
          href={`/story/${order.storyId}`}
          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold"
        >
          View
        </Link>
        <a
          href={`/api/story/${order.storyId}/pdf`}
          className="px-3 py-1.5 rounded-lg bg-white border-2 border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50"
        >
          PDF
        </a>
      </div>
    );
  }
  if (order.status === "consumed" && !order.storyId) {
    return (
      <span className="text-xs text-amber-700">
        Generation failed — contact support
      </span>
    );
  }
  if (order.status === "failed") {
    return (
      <span className="text-xs text-red-600">Payment failed</span>
    );
  }
  if (order.status === "refunded") {
    return <span className="text-xs text-gray-500">Refunded</span>;
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700",
    paid: "bg-emerald-100 text-emerald-700",
    consumed: "bg-sky-100 text-sky-700",
    failed: "bg-red-100 text-red-700",
    refunded: "bg-amber-100 text-amber-700",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}
