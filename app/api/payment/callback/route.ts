import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPaymentStatus } from "@/lib/myfatoorah";

export const runtime = "nodejs";

// MyFatoorah redirects the user here after they complete payment.
// Query parameters (per their docs):
//   paymentId   — pass to /v2/getPaymentStatus to verify
//   Id          — alias for paymentId in some flows
//   orderId     — we attached this to CallBackUrl
//
// We never trust the query string for the actual status — always verify.

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000"
  );
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  const orderId = u.searchParams.get("orderId");
  const paymentId =
    u.searchParams.get("paymentId") || u.searchParams.get("Id");

  if (!orderId) {
    return NextResponse.redirect(`${appUrl()}/payment/error?reason=missing-order`);
  }
  if (!paymentId) {
    return NextResponse.redirect(
      `${appUrl()}/payment/error?orderId=${orderId}&reason=missing-payment-id`,
    );
  }

  try {
    const status = await getPaymentStatus(paymentId, "PaymentId");

    // Sanity check: the payment's reference should match our orderId.
    if (status.reference && status.reference !== orderId) {
      console.error(
        "[/api/payment/callback] reference mismatch",
        { orderId, reference: status.reference },
      );
      return NextResponse.redirect(
        `${appUrl()}/payment/error?orderId=${orderId}&reason=mismatch`,
      );
    }

    if (status.invoiceStatus === "Paid") {
      await markOrderPaid(orderId, paymentId);
      return NextResponse.redirect(
        `${appUrl()}/story/generating?orderId=${orderId}`,
      );
    }

    // Pending status here usually means the user closed before completing.
    // We still write the paymentId so the webhook can reconcile later.
    if (status.invoiceStatus === "Pending") {
      return NextResponse.redirect(
        `${appUrl()}/story/checkout?orderId=${orderId}`,
      );
    }

    await markOrderFailed(orderId, status.transactionError ?? status.invoiceStatus);
    return NextResponse.redirect(
      `${appUrl()}/payment/error?orderId=${orderId}&reason=${encodeURIComponent(
        status.invoiceStatus,
      )}`,
    );
  } catch (err) {
    console.error("[/api/payment/callback]", err);
    return NextResponse.redirect(
      `${appUrl()}/payment/error?orderId=${orderId}&reason=verify-failed`,
    );
  }
}

async function markOrderPaid(orderId: string, paymentId: string) {
  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      myfatoorah_payment_id: paymentId,
    })
    .eq("id", orderId)
    .eq("status", "pending"); // idempotent: only flip pending → paid
  if (error) console.error("[markOrderPaid]", error);
}

async function markOrderFailed(orderId: string, reason: string) {
  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status: "failed", failure_reason: reason.slice(0, 500) })
    .eq("id", orderId)
    .eq("status", "pending");
  if (error) console.error("[markOrderFailed]", error);
}
