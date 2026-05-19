import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { formatKwd } from "@/lib/pricing";
import CheckoutButton from "./CheckoutButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderOptions = {
  title?: string;
  description?: string;
  voice?: boolean;
  characterImage?: boolean;
  characterImagePath?: string | null;
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  if (!orderId) notFound();

  const supa = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect(`/login?next=/story/checkout?orderId=${orderId}`);

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, amount_kwd, options, status, created_at, story_id")
    .eq("id", orderId)
    .single();

  if (error || !order || order.user_id !== user.id) notFound();

  // If the story has already been generated, jump straight to it.
  if (order.story_id) redirect(`/story/${order.story_id}`);
  // If the order is paid but generation hasn't run yet, send to the generating page.
  if (order.status === "paid") redirect(`/story/generating?orderId=${order.id}`);

  const opts = (order.options ?? {}) as OrderOptions;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 border-4 border-amber-200">
        <h1 className="text-3xl font-bold text-amber-700 mb-2 text-center">
          Confirm your order
        </h1>
        <p className="text-center text-gray-500 mb-6 text-sm">
          Order #{order.id.slice(0, 8)}
        </p>

        <dl className="space-y-3 mb-6">
          <Row label="Story title" value={opts.title ?? "—"} />
          <Row
            label="Voice narration"
            value={opts.voice ? "Yes" : "No"}
            mono={false}
          />
          <Row
            label="Custom character"
            value={opts.characterImage ? "Yes" : "No"}
            mono={false}
          />
          <Row label="Status" value={order.status} mono />
        </dl>

        <div className="flex items-center justify-between rounded-xl bg-amber-50 border-2 border-amber-200 px-4 py-3 mb-6">
          <span className="font-semibold text-amber-800">Total</span>
          <span className="font-bold text-amber-800 font-mono text-xl">
            {formatKwd(Number(order.amount_kwd))}
          </span>
        </div>

        {order.status === "pending" && <CheckoutButton orderId={order.id} />}

        {(order.status === "failed" || order.status === "refunded") && (
          <div className="text-center text-red-700 bg-red-50 rounded-xl p-4">
            This order is {order.status}. Please start a new one from the home
            page.
          </div>
        )}

        {order.status === "consumed" && !order.story_id && (
          <div className="text-center text-amber-700 bg-amber-50 rounded-xl p-4">
            We started generating your story but something went wrong. Contact
            support with the order number below.
          </div>
        )}

        <Link
          href="/"
          className="block text-center mt-4 text-sm text-gray-500 hover:text-amber-700"
        >
          ← Cancel and go back
        </Link>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-4 border-b border-amber-100 pb-2">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd
        className={`text-right text-gray-800 ${mono ? "font-mono text-sm" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
