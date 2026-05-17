import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = Promise<{
  q?: string;
  status?: "all" | "flagged" | "deleted" | "active";
  from?: string;
  to?: string;
  page?: string;
}>;

export default async function StoriesListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? "active";
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabaseAdmin
    .from("stories")
    .select("id, title, description, device_id, created_at, flagged_at, deleted_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (q) {
    const pat = `%${q}%`;
    query = query.or(`title.ilike.${pat},description.ilike.${pat}`);
  }
  if (status === "active") query = query.is("deleted_at", null).is("flagged_at", null);
  else if (status === "flagged") query = query.not("flagged_at", "is", null).is("deleted_at", null);
  else if (status === "deleted") query = query.not("deleted_at", "is", null);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59.999Z");

  const { data, count, error } = await query;
  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    device_id: string;
    created_at: string;
    flagged_at: string | null;
    deleted_at: string | null;
  }>;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, status, from, to, page, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === "" || v === null) continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return `/admin/stories${s ? "?" + s : ""}`;
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">Stories</h1>

      <form
        method="get"
        className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-5 gap-3"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title or description"
          className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="flagged">Flagged</option>
          <option value="deleted">Deleted</option>
        </select>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <div className="sm:col-span-5 flex justify-end gap-2">
          <Link
            href="/admin/stories"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Reset
          </Link>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-white hover:bg-slate-900"
          >
            Filter
          </button>
        </div>
      </form>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
            <tr>
              <th className="px-5 py-2">Title</th>
              <th className="px-5 py-2">Device</th>
              <th className="px-5 py-2">Created</th>
              <th className="px-5 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-red-600">
                  {error.message}
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-5 py-2">
                  <Link
                    href={`/admin/stories/${s.id}`}
                    className="font-semibold text-slate-800 hover:underline"
                  >
                    {s.title}
                  </Link>
                  {s.description && (
                    <div className="text-xs text-slate-500 line-clamp-1">
                      {s.description}
                    </div>
                  )}
                </td>
                <td className="px-5 py-2 text-slate-500 font-mono text-xs">
                  {s.device_id.slice(0, 8)}…
                </td>
                <td className="px-5 py-2 text-slate-500">
                  {new Date(s.created_at).toLocaleString()}
                </td>
                <td className="px-5 py-2">
                  {s.deleted_at ? (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                      deleted
                    </span>
                  ) : s.flagged_at ? (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
                      flagged
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">
                      active
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                  No stories match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-4 border-t border-slate-100 text-sm text-slate-600">
          <span>
            {count ?? 0} result{(count ?? 0) === 1 ? "" : "s"} · Page {page} of{" "}
            {totalPages}
          </span>
          <div className="flex gap-2">
            <Link
              href={buildHref({ page: page > 1 ? page - 1 : 1 })}
              aria-disabled={page <= 1}
              className={`px-3 py-1.5 rounded-lg font-semibold ${
                page <= 1
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-slate-100"
              }`}
            >
              ← Prev
            </Link>
            <Link
              href={buildHref({ page: page < totalPages ? page + 1 : page })}
              aria-disabled={page >= totalPages}
              className={`px-3 py-1.5 rounded-lg font-semibold ${
                page >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-slate-100"
              }`}
            >
              Next →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
