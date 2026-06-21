import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getJwks } from "@microservices-sh/auth";
import { ensureSigningKey } from "$lib/server/auth";

// Public JWKS for this app's auth module. Other microservices that verify tokens
// minted by this app resolve them against this endpoint (by the token's `iss`).
export const GET: RequestHandler = async ({ locals }) => {
  await ensureSigningKey(locals.signingKeyStore);
  const r = await getJwks({ signingKeyStore: locals.signingKeyStore });
  return json(r.ok ? r.data : { keys: [] }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
};
