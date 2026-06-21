import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getJwks } from "@microservices-sh/auth";
import { ensureSigningKey } from "$lib/server/signing";

// Public JWKS for this app's auth module — the standard verification endpoint
// for any service that needs to verify a token this app's auth module minted.
export const GET: RequestHandler = async ({ locals }) => {
  await ensureSigningKey(locals.signingKeyStore);
  const r = await getJwks({ signingKeyStore: locals.signingKeyStore });
  return json(r.ok ? r.data : { keys: [] }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
};
