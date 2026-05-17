"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDeviceId } from "@/lib/deviceId";

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    setError(null);
    setProgress("Writing & illustrating the story... (1-2 min)");

    try {
      const deviceId = getDeviceId();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, deviceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate story");

      sessionStorage.setItem("story", JSON.stringify(data.story));
      if (data.id) {
        router.push(`/story/${data.id}`);
      } else {
        router.push("/story");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl p-8 border-4 border-amber-200">
        <h1 className="text-4xl font-bold text-amber-700 mb-2 text-center">
          Kid's Story Maker
        </h1>
        <p className="text-center text-gray-500 mb-4">
          Tell us a title and an idea — we'll write & illustrate a 4-page story.
        </p>
        <div className="text-center mb-6">
          <Link
            href="/library"
            className="text-sm text-amber-700 hover:underline font-semibold"
          >
            View saved stories →
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Brave Little Fox"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:outline-none disabled:opacity-50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A young fox who lives in a magical forest learns to be brave when his friend gets lost..."
              disabled={loading}
              rows={5}
              className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:outline-none resize-none disabled:opacity-50"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-60"
          >
            {loading ? progress || "Generating..." : "Create Story ✨"}
          </button>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 rounded-lg p-3">
              {error}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
