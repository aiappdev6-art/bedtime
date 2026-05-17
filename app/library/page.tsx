"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDeviceId } from "@/lib/deviceId";

type LibraryItem = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  coverUrl: string | null;
};

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const deviceId = getDeviceId();
    fetch(`/api/library?deviceId=${encodeURIComponent(deviceId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setItems(data.stories);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <header className="max-w-5xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-700">
          Your Library
        </h1>
        <Link
          href="/"
          className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-xl font-semibold shadow hover:shadow-lg transition"
        >
          + New Story
        </Link>
      </header>

      {error && (
        <div className="max-w-5xl mx-auto text-red-600 bg-red-50 rounded-lg p-4">
          {error}
        </div>
      )}

      {!items && !error && (
        <p className="max-w-5xl mx-auto text-amber-700">Loading...</p>
      )}

      {items && items.length === 0 && (
        <div className="max-w-5xl mx-auto text-center text-gray-500 mt-16">
          No stories yet. Create your first one!
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((s) => (
            <li key={s.id}>
              <Link
                href={`/story/${s.id}`}
                className="block bg-white rounded-2xl shadow border-2 border-amber-200 overflow-hidden hover:shadow-lg transition"
              >
                {s.coverUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={s.coverUrl}
                    alt={s.title}
                    className="w-full aspect-[4/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[4/3] bg-amber-100" />
                )}
                <div className="p-4">
                  <h2 className="font-bold text-amber-800 line-clamp-1">
                    {s.title}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
