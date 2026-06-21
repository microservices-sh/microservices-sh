import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { handleWebhook } from "@microservices-sh/payment";

// Stripe webhook receiver. The payment module verifies the `Stripe-Signature`
// header against STRIPE_WEBHOOK_SECRET, dedupes redelivered event ids, and
// transitions the matching payment (succeeded / refunded / failed). Thin adapter:
// raw body in, module use case does the work.
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const secret = platform?.env?.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: "Webhook secret is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  const result = await handleWebhook(rawBody, signature, {
    paymentRepository: locals.paymentRepository,
    webhookSecret: secret
  });

  if (!result.ok) return json({ error: result.error.message }, { status: result.status });
  return json(result.data, { status: result.status });
};
