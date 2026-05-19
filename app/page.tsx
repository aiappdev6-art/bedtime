"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthChip from "./AuthChip";
import { PRICES, computeTotal, formatKwd } from "@/lib/pricing";

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [voice, setVoice] = useState(false);
  const [characterImage, setCharacterImage] = useState(false);
  const [characterFile, setCharacterFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => computeTotal({ voice, characterImage }),
    [voice, characterImage],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (characterImage && !characterFile) {
      setError("Please choose an image for the main character, or uncheck that option.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Upload character image (if any).
      let characterImagePath: string | null = null;
      if (characterImage && characterFile) {
        setProgress("Uploading your photo...");
        const fd = new FormData();
        fd.append("file", characterFile);
        const up = await fetch("/api/upload/character", {
          method: "POST",
          body: fd,
        });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error || "Upload failed");
        characterImagePath = upData.path;
      }

      // 2. Create the pending order.
      setProgress("Creating order...");
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          voice,
          characterImage,
          characterImagePath,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Order failed");

      // 3. To checkout.
      router.push(`/story/checkout?orderId=${orderData.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl p-8 border-4 border-amber-200">
        <div className="flex justify-end mb-2">
          <AuthChip />
        </div>
        <h1 className="text-4xl font-bold text-amber-700 mb-2 text-center">
          Kid&apos;s Story Maker
        </h1>
        <p className="text-center text-gray-500 mb-4">
          Tell us a title and an idea — we&apos;ll write &amp; illustrate a 4-page story.
        </p>
        <div className="flex justify-center gap-4 mb-6 text-sm">
          <Link
            href="/library"
            className="text-amber-700 hover:underline font-semibold"
          >
            Saved stories →
          </Link>
          <Link
            href="/orders"
            className="text-amber-700 hover:underline font-semibold"
          >
            My orders →
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

          {/* Options */}
          <fieldset className="rounded-xl border-2 border-amber-100 p-4 space-y-3">
            <legend className="text-sm font-semibold text-gray-700 px-2">
              Options
            </legend>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={voice}
                onChange={(e) => setVoice(e.target.checked)}
                disabled={loading}
                className="mt-1 w-5 h-5 accent-amber-500"
              />
              <span className="flex-1">
                <span className="font-semibold text-gray-800">Voice narration</span>
                <span className="block text-xs text-gray-500">
                  Each page is read aloud by a friendly narrator.
                </span>
              </span>
              <span className="text-sm font-mono text-amber-700">
                +{formatKwd(PRICES.voice)}
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={characterImage}
                onChange={(e) => {
                  setCharacterImage(e.target.checked);
                  if (!e.target.checked) setCharacterFile(null);
                }}
                disabled={loading}
                className="mt-1 w-5 h-5 accent-amber-500"
              />
              <span className="flex-1">
                <span className="font-semibold text-gray-800">
                  Use your photo as the main character
                </span>
                <span className="block text-xs text-gray-500">
                  Upload a face photo and we&apos;ll make them the hero.
                </span>
              </span>
              <span className="text-sm font-mono text-amber-700">
                +{formatKwd(PRICES.characterImage)}
              </span>
            </label>

            {characterImage && (
              <div className="pl-8">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setCharacterFile(e.target.files?.[0] ?? null)}
                  disabled={loading}
                  className="text-sm w-full"
                />
                {characterFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    {characterFile.name} ({Math.round(characterFile.size / 1024)} KB)
                  </p>
                )}
              </div>
            )}
          </fieldset>

          {/* Total */}
          <div className="flex items-center justify-between rounded-xl bg-amber-50 border-2 border-amber-200 px-4 py-3">
            <span className="font-semibold text-amber-800">Total</span>
            <span className="font-bold text-amber-800 font-mono text-lg">
              {formatKwd(total)}
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-60"
          >
            {loading
              ? progress || "Working..."
              : `Continue to payment — ${formatKwd(total)}`}
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
