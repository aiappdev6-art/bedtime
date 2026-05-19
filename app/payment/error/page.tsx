import Link from "next/link";

export const dynamic = "force-dynamic";

const REASON_MESSAGES: Record<string, string> = {
  "missing-order": "We couldn't find your order.",
  "missing-payment-id": "MyFatoorah didn't return a payment reference.",
  mismatch: "The payment reference didn't match your order.",
  "verify-failed": "We couldn't verify the payment with MyFatoorah.",
  Failed: "The payment was declined.",
  Canceled: "You cancelled the payment.",
  Expired: "The payment session expired.",
};

export default async function PaymentErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; reason?: string }>;
}) {
  const { orderId, reason } = await searchParams;
  const message =
    (reason && REASON_MESSAGES[reason]) ||
    reason ||
    "Something went wrong with the payment.";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border-4 border-red-200 text-center">
        <h1 className="text-3xl font-bold text-red-700 mb-2">Payment failed</h1>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="space-y-2">
          {orderId && (
            <Link
              href={`/story/checkout?orderId=${orderId}`}
              className="block w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition"
            >
              Try paying again
            </Link>
          )}
          <Link
            href="/"
            className="block w-full py-3 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition"
          >
            ← Start over
          </Link>
        </div>

        {orderId && (
          <p className="text-xs text-gray-400 mt-6 font-mono">
            Order #{orderId.slice(0, 8)}
          </p>
        )}
      </div>
    </main>
  );
}
