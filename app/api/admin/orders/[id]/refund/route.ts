import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, checkOrigin } from "@/lib/adminGate";
import { refundPayment } from "@/lib/myfatoorah";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  status: string;
  amount_kwd: number;
  myfatoorah_payment_id: string | null;
  story_id: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkOrigin(req))
    return NextResponse.json({ error: "bad origin" }, { status: 403 });

  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { reason } = (await req.json().catch(() => ({}))) as {
    reason?: string;
  };

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, amount_kwd, myfatoorah_payment_id, story_id")
    .eq("id", id)
    .single<OrderRow>();
  if (error || !order)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.status === "refunded")
    return NextResponse.json({ error: "Already refunded" }, { status: 409 });
  if (order.status === "pending" || order.status === "failed")
    return NextResponse.json(
      { error: `Cannot refund a ${order.status} order` },
      { status: 409 },
    );
  if (!order.myfatoorah_payment_id)
    return NextResponse.json(
      { error: "No MyFatoorah payment id on this order" },
      { status: 422 },
    );

  try {
    const result = await refundPayment({
      paymentId: order.myfatoorah_payment_id,
      amountKwd: Number(order.amount_kwd),
      reason: reason || "Admin refund",
      reference: order.id,
    });

    const { error: upErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "refunded",
        failure_reason: `admin refund: ${(reason || "no reason").slice(0, 200)} (mf-refund=${result.refundId})`,
      })
      .eq("id", order.id);
    if (upErr) console.error("[admin:refund] update", upErr);

    // If the order produced a story, soft-delete it too so the customer can't
    // keep enjoying a refunded purchase.
    if (order.story_id) {
      const { error: delErr } = await supabaseAdmin
        .from("stories")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", order.story_id);
      if (delErr) console.error("[admin:refund] soft-delete story", delErr);
    }

    return NextResponse.json({ ok: true, refundId: result.refundId });
  } catch (err) {
    console.error("[admin:refund]", err);
    const message = err instanceof Error ? err.message : "Refund failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
