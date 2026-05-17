"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Action = "flag" | "unflag" | "delete" | "restore";

export default function ModerationActions({
  id,
  flagged,
  deleted,
}: {
  id: string;
  flagged: boolean;
  deleted: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function act(action: Action) {
    setError(null);
    let reason: string | null = null;
    if (action === "flag") {
      reason = window.prompt("Reason for flagging? (optional)") || null;
    } else if (action === "delete") {
      if (!confirm("Soft-delete this story? Hidden from public, recoverable."))
        return;
    }

    const res = await fetch(`/api/admin/stories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Action failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  const btn =
    "px-3 py-1.5 rounded-lg text-sm font-semibold transition disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {flagged ? (
        <button
          disabled={busy}
          onClick={() => act("unflag")}
          className={`${btn} bg-amber-100 text-amber-800 hover:bg-amber-200`}
        >
          Unflag
        </button>
      ) : (
        <button
          disabled={busy || deleted}
          onClick={() => act("flag")}
          className={`${btn} bg-amber-500 text-white hover:bg-amber-600`}
        >
          Flag
        </button>
      )}

      {deleted ? (
        <button
          disabled={busy}
          onClick={() => act("restore")}
          className={`${btn} bg-emerald-100 text-emerald-800 hover:bg-emerald-200`}
        >
          Restore
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={() => act("delete")}
          className={`${btn} bg-red-500 text-white hover:bg-red-600`}
        >
          Soft delete
        </button>
      )}

      {error && (
        <span className="text-sm text-red-600 ml-2">{error}</span>
      )}
    </div>
  );
}
