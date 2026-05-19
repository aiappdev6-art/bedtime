"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  "Writing the story...",
  "Designing the characters...",
  "Painting the illustrations...",
  "Adding the final touches...",
];

export default function GeneratingRunner({ orderId }: { orderId: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // React 18 strict mode double-mounts effects in dev. Guard so we only
    // ever POST once per page load.
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    // Rotate the stage label every ~25 seconds so the user has something to watch.
    const stageInterval = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 25000);

    (async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.id) {
          throw new Error(data.error || "Generation failed");
        }
        router.replace(`/story/${data.id}`);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        clearInterval(stageInterval);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(stageInterval);
    };
  }, [orderId, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 border-4 border-amber-200 text-center">
        {!error ? (
          <>
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-amber-200" />
              <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 border-transparent animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-amber-700 mb-2">
              {STAGES[stage]}
            </h1>
            <p className="text-sm text-gray-500">
              This takes 1–2 minutes. Please keep this tab open.
            </p>
            <p className="text-xs text-gray-400 mt-6 font-mono">
              Order #{orderId.slice(0, 8)}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-red-700 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-600 mb-6">{error}</p>
            <p className="text-xs text-gray-500 mb-4">
              Your payment has not been refunded automatically. Please contact
              support with your order number below.
            </p>
            <p className="text-xs text-gray-400 font-mono">
              Order #{orderId}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
