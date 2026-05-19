"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { safeNext } from "@/lib/safeNext";

type Step = "email" | "code";

const RESEND_SECONDS = 60;

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (cooldown > 0) return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email: trimmed,
      options: {
        // We want the 6-digit code, not a magic link.
        shouldCreateUser: true,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("code");
    setInfo(`We sent a 6-digit code to ${trimmed}.`);
    setCooldown(RESEND_SECONDS);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    const { error } = await supabaseBrowser.auth.verifyOtp({
      email: email.trim(),
      token: trimmed,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border-4 border-amber-200">
        <h1 className="text-3xl font-bold text-amber-700 mb-2 text-center">
          Sign in
        </h1>
        <p className="text-center text-gray-500 mb-6">
          {step === "email"
            ? "Enter your email to receive a verification code."
            : "Enter the 6-digit code we sent you."}
        </p>

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">
                Email
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:outline-none disabled:opacity-50"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                We'll email a 6-digit code. No password needed.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-60"
            >
              {loading
                ? "Sending..."
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:outline-none disabled:opacity-50 tracking-widest text-center text-2xl"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setInfo(null);
                setError(null);
              }}
              className="w-full text-sm text-gray-500 hover:text-amber-700"
            >
              ← Use a different email
            </button>
          </form>
        )}

        {info && (
          <div className="mt-4 text-green-700 text-sm text-center bg-green-50 rounded-lg p-3">
            {info}
          </div>
        )}
        {error && (
          <div className="mt-4 text-red-600 text-sm text-center bg-red-50 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
