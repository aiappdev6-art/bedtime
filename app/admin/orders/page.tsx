import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatKwd } from "@/lib/pricing";
import OrderActions from "./OrderActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderOptions = {
  title?: string;
  voice?: boolean;
  characterImage?: boolean;
};

type OrderRow = {
  id: string;
  user_id: string;
  story_id: string | null;
  amount_kwd: number;
  options: OrderOptions | null;
  status: string;
  myfatoorah_invoice_id: string | null;
  myfatoorah_payment_id: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  phone: string | null;
};

const STATUS_FILTERS = [
  "all",
  "pending",
  "paid",
  "consumed",
  "failed",
  "refunded",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function isStatusFilter(v: unknown): v is StatusFilter {
  return (
    typeof v === "string" && (STATUS_FILTERS as readonly string[]).includes(v)
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; since?: string }>;
}) {
  const sp = await searchParams;
  const status: StatusFilter = isStatusFilter(sp.status) ? sp.status : "all";
  const since = typeof sp.since === "string" ? sp.since : "";

  let query = supabaseAdmin
    .from("orders")
    .select(
      "id, user_id, story_id, amount_kwd, options, status, myfatoorah_invoice_id, myfatoorah_payment_id, failure_reason, created_at, paid_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") query = query.eq("status", status);
  if (since) {
    // Accept YYYY-MM-DD; ignore garbage.
    if (/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      query = query.gte("created_at", `${since}T00:00:00.000Z`);
    }
  }

  const { data: orders, error } = await query;
  if (error) {
    console.error("[admin/orders] query", error);
  }
  const rows = (orders ?? []) as OrderRow[];

  // Bulk-fetch profiles for the user_ids on this page.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  let profiles: Record<string, ProfileRow> = {};
  if (userIds.length > 0) {
    const { data: profRows } = await supabaseAdmin
      .from("profiles")
      .select("id, email, phone")
      .in("id", userIds);
    profiles = Object.fromEntries(
      (profRows ?? []).map((p) => [p.id, p as ProfileRow]),
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Orders</h1>

      <form className="flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-slate-200 p-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="border-2 border-slate-200 rounded-lg px-3 py-1.5 text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
            Since (YYYY-MM-DD)
          </label>
          <input
            name="since"
            type="date"
            defaultValue={since}
            className="border-2 border-slate-200 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-semibold"
        >
          Apply
        </button>
        <Link
          href="/admin/orders"
          className="px-4 py-1.5 border-2 border-slate-200 text-slate-600 rounded-lg text-sm font-semibold"
        >
          Reset
        </Link>
      </form>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
            <tr>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Options</th>
              <th className="px-4 py-2">Story</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const p = profiles[o.user_id];
              const customer = p?.phone
                ? `+${p.phone}`
                : (p?.email ?? o.user_id.slice(0, 8) + "…");
              return (
                <tr key={o.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                    {new Date(o.created_at).toLocaleString()}
                    <div className="text-[10px] text-slate-400 font-mono">
                      #{o.id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={o.status} />
                    {o.failure_reason && (
                      <div className="text-[10px] text-red-600 mt-1 max-w-[180px]">
                        {o.failure_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                    {formatKwd(Number(o.amount_kwd))}
                  </td>
                  <td className="px-4 py-2 text-slate-700 font-mono text-xs">
                    {customer}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div className="max-w-[160px] truncate" title={o.options?.title ?? ""}>
                      {o.options?.title ?? "—"}
                    </div>
                    <div className="flex gap-1 mt-1">
                      {o.options?.voice && <Pill>V</Pill>}
                      {o.options?.characterImage && <Pill>C</Pill>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {o.story_id ? (
                      <Link
                        href={`/admin/stories/${o.story_id}`}
                        className="text-slate-700 hover:underline font-mono"
                      >
                        {o.story_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <OrderActions
                      orderId={o.id}
                      status={o.status}
                      hasPaymentId={!!o.myfatoorah_payment_id}
                      hasStory={!!o.story_id}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No orders match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
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
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}
    >
      {status}
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
      {children}
    </span>
  );
}
