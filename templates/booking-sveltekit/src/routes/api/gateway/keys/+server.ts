import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { createApiKey } from "@microservices-sh/gateway";
import { requireScope } from "@microservices-sh/auth/scope";
import { toSvelteKitResponse } from "$lib/server/adapters/sveltekit-response";

// Admin: create a new API key. Requires a token carrying the gateway.admin scope
// (the front door already verified the token in hooks.server.ts).
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.claims || !requireScope(locals.claims, "gateway.admin").ok) {
    return json({ ok: false, error: "Forbidden: gateway.admin scope required." }, { status: 403 });
  }
  const result = await createApiKey(await request.json(), { apiKeyStore: locals.apiKeyStore });
  return toSvelteKitResponse(result);
};
