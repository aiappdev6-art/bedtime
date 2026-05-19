import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPaymentStatus, verifyWebhookSignature } from "@/lib/myfatoorah";

export const runtime = "nodejs";

// MyFatoorah server-to-server webhook. Fires for payment status changes.
// Payload shape varies by event type, but always includes:
//   EventType: number   (1 = TransactionStatusChanged, 2 = RefundStatusChanged, ...)
//   Data: { InvoiceId, PaymentId?, InvoiceStatus, ... }
//
// Signature: header "MyFatoorah-Signature" = base64(HMAC_SHA256(secret, rawBody))
// (Only enforced when MYFATOORAH_WEBHOOK_SECRET is set.)
//
// This endpoint is idempotent — if the order is already paid we skip.
// We always re-verify the status via getPaymentStatus (defence in depth:
// don't trust the webhook body for the "Paid" claim).

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("myfatoorah-signature");

  if (!verifyWebhookSignature(raw, sig)) {
    console.warn("[/api/payment/webhook] bad signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    EventType?: number;
    Data?: {
      InvoiceId?: number | string;
      PaymentId?: string;
      InvoiceStatus?: string;
      CustomerReference?: string;
      UserDefinedField?: string;
    };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = payload.Data ?? {};
  const orderId = data.CustomerReference || data.UserDefinedField;
  const paymentId = data.PaymentId;
  const invoiceId = data.InvoiceId ? String(data.InvoiceId) : null;

  if (!orderId) {
    return NextResponse.json(
      { error: "CustomerReference (orderId) missing" },
      { status: 400 },
    );
  }

  // Re-verify with MyFatoorah rather than trusting the webhook body.
  try {
    const status = paymentId
      ? await getPaymentStatus(paymentId, "PaymentId")
      : invoiceId
        ? await getPaymentStatus(invoiceId, "InvoiceId")
        : null;

    if (!status) {
      return NextResponse.json(
        { error: "Neither PaymentId nor InvoiceId provided" },
        { status: 400 },
      );
    }

    if (status.invoiceStatus === "Paid") {
      const { error } = await supabaseAdmin
        .from("orders")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          myfatoorah_payment_id: status.paymentId,
        })
        .eq("id", orderId)
        .eq("status", "pending"); // idempotent
      if (error) console.error("[webhook] mark paid", error);
    } else if (
      status.invoiceStatus === "Failed" ||
      status.invoiceStatus === "Canceled" ||
      status.invoiceStatus === "Expired"
    ) {
      const { error } = await supabaseAdmin
        .from("orders")
        .update({
          status: "failed",
          failure_reason: (
            status.transactionError ?? status.invoiceStatus
          ).slice(0, 500),
        })
        .eq("id", orderId)
        .eq("status", "pending");
      if (error) console.error("[webhook] mark failed", error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/payment/webhook]", err);
    // Returning 500 makes MyFatoorah retry — that's what we want on transient errors.
    return NextResponse.json({ error: "verify failed" }, { status: 500 });
  }
}
