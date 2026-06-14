import type { RequestHandler } from "./$types";
import { issueToken } from "@microservices-sh/gateway";
import { toSvelteKitResponse } from "$lib/server/adapters/sveltekit-response";

// Public exchange: present an API key, receive a short-lived scoped token.
export const POST: RequestHandler = async ({ request, locals }) => {
  const result = await issueToken(await request.json(), {
    apiKeyStore: locals.apiKeyStore,
    rateLimitStore: locals.rateLimitStore,
    tokenMinter: locals.tokenMinter
  });
  return toSvelteKitResponse(result);
};
