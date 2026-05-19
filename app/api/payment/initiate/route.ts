import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { sendPayment } from "@/lib/myfatoorah";
import { computeTotal } from "@/lib/pricing";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  user_id: string;
  amount_kwd: number;
  status: string;
  options: {
    voice?: boolean;
    characterImage?: boolean;
    title?: string;
  } | null;
};

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000"
  );
}

export async function POST(req: NextRequest) {
  const supa = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { orderId } = (await req.json().catch(() => ({}))) as {
    orderId?: string;
  };
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, amount_kwd, status, options")
    .eq("id", orderId)
    .single<OrderRow>();
  if (error || !data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (data.user_id !== user.id) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }
  if (data.status !== "pending") {
    return NextResponse.json(
      { error: `Order is ${data.status}, cannot pay` },
      { status: 409 },
    );
  }

  // Re-verify the amount server-side to catch any drift between order creation
  // and now (e.g. pricing env var changed). Refuse to pay if it would differ.
  const expected = computeTotal({
    voice: data.options?.voice === true,
    characterImage: data.options?.characterImage === true,
  });
  if (Math.abs(Number(data.amount_kwd) - expected) > 0.0005) {
    return NextResponse.json(
      { error: "Order amount mismatch — please start a new order." },
      { status: 409 },
    );
  }

  try {
    // CustomerName goes to MyFatoorah's strict-validation field (letters/spaces
    // only). Don't put user-supplied strings (story title) in here — they'll be
    // rejected. The story title is already stored on the order; lib/myfatoorah
    // will sanitise this further as a safety net.
    const customerName = user.email
      ? user.email.split("@")[0]
      : "Bedtime Customer";

    const result = await sendPayment({
      orderId: data.id,
      amountKwd: Number(data.amount_kwd),
      customer: {
        name: customerName,
        phone: user.phone ? `+${user.phone}` : null,
        email: user.email ?? null,
      },
      callbackUrl: `${appUrl()}/api/payment/callback?orderId=${data.id}`,
      errorUrl: `${appUrl()}/payment/error?orderId=${data.id}`,
    });

    const { error: upErr } = await supabaseAdmin
      .from("orders")
      .update({ myfatoorah_invoice_id: result.invoiceId })
      .eq("id", data.id);
    if (upErr) {
      console.error("[/api/payment/initiate] persist invoice_id", upErr);
      // Non-fatal — we still got the URL. Webhook will reconcile.
    }

    return NextResponse.json({ url: result.invoiceUrl });
  } catch (err) {
    console.error("[/api/payment/initiate]", err);
    const message = err instanceof Error ? err.message : "Payment init failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
