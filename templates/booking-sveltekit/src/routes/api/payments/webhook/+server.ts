import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { handleWebhook } from "@microservices-sh/payment";
import { getPaymentDeps } from "$lib/server/payment-deps";

// Stripe payment webhook. Auth is the Stripe signature (verified inside
// handleWebhook against STRIPE_WEBHOOK_SECRET) — fail-closed if unconfigured.
export const POST: RequestHandler = async ({ request, platform }) => {
  const secret = platform?.env?.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return json({ ok: false, error: { code: "NOT_CONFIGURED", message: "Webhook not configured." } }, { status: 503 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const { paymentRepository } = getPaymentDeps(platform?.env?.DB, platform?.env);

  const result = await handleWebhook(rawBody, signature, { paymentRepository, webhookSecret: secret });
  return json(result, { status: result.ok ? 200 : result.status });
};
