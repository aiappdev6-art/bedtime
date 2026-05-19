// MyFatoorah HTTP client. Server-only.
//
// Docs: https://docs.myfatoorah.com/docs/send-payment
// Sandbox: https://apitest.myfatoorah.com   Live: https://api.myfatoorah.com
//
// Flow we use:
//   1. POST /v2/SendPayment with NotificationOption: "LNK" → returns Data.InvoiceURL + Data.InvoiceId
//   2. User pays, MyFatoorah redirects to CallBackUrl with ?paymentId=...&Id=...
//   3. We POST /v2/getPaymentStatus with { Key: paymentId, KeyType: "PaymentId" } to confirm
//   4. (Optional but recommended) Webhook POST hits /api/payment/webhook — same verify path
//
// We treat the redirect's query string as a hint only; the source of truth is
// always a /v2/getPaymentStatus call.

import crypto from "node:crypto";

const BASE_URL =
  process.env.MYFATOORAH_BASE_URL ?? "https://apitest.myfatoorah.com";
const API_KEY = process.env.MYFATOORAH_API_KEY ?? "";

function authHeaders(): HeadersInit {
  if (!API_KEY) {
    throw new Error("MYFATOORAH_API_KEY is not configured");
  }
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

type MFResponse<T> = {
  IsSuccess: boolean;
  Message?: string;
  ValidationErrors?: Array<{ Name: string; Error: string }> | null;
  Data?: T;
};

export type SendPaymentInput = {
  orderId: string;
  amountKwd: number;
  customer: {
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  callbackUrl: string;
  errorUrl: string;
};

export type SendPaymentResult = {
  invoiceId: string;
  invoiceUrl: string;
};

/** Drop keys whose value is undefined / null / "" so we don't send empty
 *  fields that some MyFatoorah validators reject. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

export async function sendPayment(
  input: SendPaymentInput,
): Promise<SendPaymentResult> {
  // Split a single phone like "+96599887766" into country code + number.
  // MyFatoorah's docs are inconsistent: some endpoints want "+965", others
  // want "965". Plain digits is the safer default — accepted by both.
  let mobileCountryCode: string | undefined;
  let customerMobile: string | undefined;
  if (input.customer.phone) {
    const m = input.customer.phone.match(/^\+?(\d{1,4})(\d{6,})$/);
    if (m) {
      mobileCountryCode = m[1]; // digits only, no leading "+"
      customerMobile = m[2];
    }
  }

  const body = compact({
    NotificationOption: "LNK", // we want the URL only, no SMS/email from MF
    InvoiceValue: Number(input.amountKwd.toFixed(3)),
    CustomerName: (input.customer.name || "Story customer").slice(0, 50),
    DisplayCurrencyIso: "KWD",
    MobileCountryCode: mobileCountryCode,
    CustomerMobile: customerMobile,
    CustomerEmail: input.customer.email ?? undefined,
    CallBackUrl: input.callbackUrl,
    ErrorUrl: input.errorUrl,
    Language: "EN",
    CustomerReference: input.orderId,
    UserDefinedField: input.orderId,
  });

  const res = await fetch(`${BASE_URL}/v2/SendPayment`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  // Read text first so we can log the raw response even if JSON parsing fails.
  const rawText = await res.text();
  let json: MFResponse<{
    InvoiceId: number;
    InvoiceURL: string;
    CustomerReference: string;
    UserDefinedField: string;
  }>;
  try {
    json = JSON.parse(rawText);
  } catch {
    console.error(
      "[myfatoorah:SendPayment] non-JSON response",
      res.status,
      rawText.slice(0, 500),
    );
    throw new Error(
      `MyFatoorah SendPayment failed: non-JSON response (HTTP ${res.status})`,
    );
  }

  if (!res.ok || !json.IsSuccess || !json.Data) {
    // Log everything so we can diagnose. Redact the API key (not in body anyway).
    console.error("[myfatoorah:SendPayment] request body:", body);
    console.error("[myfatoorah:SendPayment] response:", {
      status: res.status,
      IsSuccess: json.IsSuccess,
      Message: json.Message,
      ValidationErrors: json.ValidationErrors,
    });
    const reason =
      json.ValidationErrors?.map((e) => `${e.Name}: ${e.Error}`).join("; ") ||
      json.Message ||
      `HTTP ${res.status}`;
    throw new Error(`MyFatoorah SendPayment failed: ${reason}`);
  }

  return {
    invoiceId: String(json.Data.InvoiceId),
    invoiceUrl: json.Data.InvoiceURL,
  };
}

export type PaymentStatus = {
  invoiceStatus: string; // "Paid" | "Pending" | "Failed" | "Canceled" | ...
  paidAmount: number;
  paidCurrency: string;
  paymentId: string | null;
  reference: string | null; // our CustomerReference (orderId)
  userDefinedField: string | null;
  transactionStatus: string | null; // "Succss" | "Failed" | ... (MyFatoorah typo is intentional in their API)
  transactionError: string | null;
};

export async function getPaymentStatus(
  key: string,
  keyType: "PaymentId" | "InvoiceId",
): Promise<PaymentStatus> {
  const res = await fetch(`${BASE_URL}/v2/getPaymentStatus`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ Key: key, KeyType: keyType }),
  });
  const json = (await res.json()) as MFResponse<{
    InvoiceStatus: string;
    InvoiceReference: string;
    CustomerReference: string | null;
    UserDefinedField: string | null;
    InvoiceTransactions?: Array<{
      PaymentId: string;
      TransactionStatus: string;
      Error: string | null;
      PaidCurrency: string;
      PaidCurrencyValue: number;
    }>;
  }>;

  if (!res.ok || !json.IsSuccess || !json.Data) {
    const reason = json.Message || `HTTP ${res.status}`;
    throw new Error(`MyFatoorah getPaymentStatus failed: ${reason}`);
  }

  const latestTxn = json.Data.InvoiceTransactions?.at(-1) ?? null;
  return {
    invoiceStatus: json.Data.InvoiceStatus,
    paidAmount: latestTxn?.PaidCurrencyValue ?? 0,
    paidCurrency: latestTxn?.PaidCurrency ?? "KWD",
    paymentId: latestTxn?.PaymentId ?? null,
    reference: json.Data.CustomerReference,
    userDefinedField: json.Data.UserDefinedField,
    transactionStatus: latestTxn?.TransactionStatus ?? null,
    transactionError: latestTxn?.Error ?? null,
  };
}

export type RefundInput = {
  paymentId: string;
  amountKwd: number;
  /** Short reason shown in MyFatoorah dashboard. */
  reason?: string;
  /** Order id for our records (kept in MyFatoorah for reconciliation). */
  reference?: string;
};

export type RefundResult = {
  refundId: string;
  refundReference: string | null;
};

/**
 * Issue a refund against a previous successful payment.
 * Endpoint: POST /v2/MakeRefund
 */
export async function refundPayment(
  input: RefundInput,
): Promise<RefundResult> {
  const body = {
    KeyType: "PaymentId",
    Key: input.paymentId,
    RefundChargeOnCustomer: false,
    ServiceChargeOnCustomer: false,
    Amount: Number(input.amountKwd.toFixed(3)),
    Comment: (input.reason ?? "Admin refund").slice(0, 200),
    CustomerReference: input.reference ?? null,
  };

  const res = await fetch(`${BASE_URL}/v2/MakeRefund`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as MFResponse<{
    RefundId: number | string;
    RefundReference: string | null;
  }>;

  if (!res.ok || !json.IsSuccess || !json.Data) {
    const reason =
      json.Message ||
      json.ValidationErrors?.map((e) => `${e.Name}: ${e.Error}`).join("; ") ||
      `HTTP ${res.status}`;
    throw new Error(`MyFatoorah MakeRefund failed: ${reason}`);
  }

  return {
    refundId: String(json.Data.RefundId),
    refundReference: json.Data.RefundReference ?? null,
  };
}

/**
 * Verify the webhook HMAC signature MyFatoorah sends in the
 * `MyFatoorah-Signature` header. The signature is base64(HMAC_SHA256(secret, body)).
 *
 * If MYFATOORAH_WEBHOOK_SECRET is not set we accept the webhook (dev mode).
 * In production set this to whatever the MyFatoorah portal generates.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.MYFATOORAH_WEBHOOK_SECRET;
  if (!secret) return true; // dev-mode pass-through
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}
