import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoryRow = {
  id: string;
  title: string;
  device_id: string;
  created_at: string;
  flagged_at: string | null;
  deleted_at: string | null;
};

async function getStats() {
  const now = new Date();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const startOfDay = (d: Date) => new Date(ymd(d) + "T00:00:00.000Z");

  const today = startOfDay(now);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(today.getUTCDate() - 6);

  const [totalRes, todayRes, weekRes, flaggedRes, deletedRes, devicesRes] =
    await Promise.all([
      supabaseAdmin.from("stories").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("stories")
        .select("id", { count: "exact", head: true })
        .gte("created_at", today.toISOString()),
      supabaseAdmin
        .from("stories")
        .select("created_at")
        .gte("created_at", sevenDaysAgo.toISOString())
        .is("deleted_at", null),
      supabaseAdmin
        .from("stories")
        .select("id", { count: "exact", head: true })
        .not("flagged_at", "is", null)
        .is("deleted_at", null),
      supabaseAdmin
        .from("stories")
        .select("id", { count: "exact", head: true })
        .not("deleted_at", "is", null),
      supabaseAdmin.from("stories").select("device_id").is("deleted_at", null),
    ]);

  const total = totalRes.count ?? 0;
  const todayCount = todayRes.count ?? 0;
  const flagged = flaggedRes.count ?? 0;
  const deleted = deletedRes.count ?? 0;
  const uniqueDevices = new Set(
    (devicesRes.data ?? []).map((r) => r.device_id),
  ).size;

  // Bucket the last 7 days for a tiny bar chart.
  const buckets: { day: string; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    buckets.push({
      day: ymd(d),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      count: 0,
    });
  }
  for (const row of weekRes.data ?? []) {
    const key = row.created_at.slice(0, 10);
    const b = buckets.find((b) => b.day === key);
    if (b) b.count++;
  }
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return { total, todayCount, flagged, deleted, uniqueDevices, buckets, max };
}

async function getRecent(): Promise<StoryRow[]> {
  const { data } = await supabaseAdmin
    .from("stories")
    .select("id, title, device_id, created_at, flagged_at, deleted_at")
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as StoryRow[];
}

export default async function AdminDashboard() {
  const [stats, recent] = await Promise.all([getStats(), getRecent()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total stories" value={stats.total} />
        <StatCard label="Today" value={stats.todayCount} />
        <StatCard label="Unique devices" value={stats.uniqueDevices} />
        <StatCard label="Flagged" value={stats.flagged} tone="amber" />
        <StatCard label="Deleted" value={stats.deleted} tone="red" />
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Last 7 days</h2>
        <div className="flex items-end gap-2 h-32">
          {stats.buckets.map((b) => (
            <div key={b.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] text-slate-500 font-mono">
                {b.count}
              </div>
              <div
                className="w-full bg-slate-800 rounded-t"
                style={{
                  height: `${(b.count / stats.max) * 100}%`,
                  minHeight: b.count > 0 ? "4px" : "1px",
                }}
              />
              <div className="text-xs text-slate-600">{b.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Recent stories</h2>
          <Link
            href="/admin/stories"
            className="text-sm text-slate-600 hover:underline font-semibold"
          >
            View all →
          </Link>
        </div>
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
            {recent.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-5 py-2">
                  <Link
                    href={`/admin/stories/${s.id}`}
                    className="font-semibold text-slate-800 hover:underline"
                  >
                    {s.title}
                  </Link>
                </td>
                <td className="px-5 py-2 text-slate-500 font-mono text-xs">
                  {s.device_id.slice(0, 8)}…
                </td>
                <td className="px-5 py-2 text-slate-500">
                  {new Date(s.created_at).toLocaleString()}
                </td>
                <td className="px-5 py-2">
                  <StatusBadge row={s} />
                </td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                  No stories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber" | "red";
}) {
  const color =
    tone === "amber"
      ? "text-amber-600"
      : tone === "red"
        ? "text-red-600"
        : "text-slate-800";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ row }: { row: StoryRow }) {
  if (row.deleted_at) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
        deleted
      </span>
    );
  }
  if (row.flagged_at) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
        flagged
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">
      active
    </span>
  );
}
