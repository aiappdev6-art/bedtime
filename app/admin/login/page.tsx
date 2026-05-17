"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialError =
    params.get("error") === "not-admin"
      ? "That account is not an admin."
      : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const next = params.get("next") || "/admin";
    router.push(next);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 border border-slate-200 space-y-4"
      >
        <h1 className="text-2xl font-bold text-slate-800">Admin Login</h1>
        <p className="text-sm text-slate-500">
          Sign in to manage stories and moderation.
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-lg font-semibold transition"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded p-2 text-center">
            {error}
          </div>
        )}
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
