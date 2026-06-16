import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getJwks } from "@microservices-sh/auth";
import { ensureSigningKey } from "$lib/server/ads";

// Public JWKS for this app's auth module. The upstream ads service points its
// ADS_ENTITLEMENT_JWKS_URL here to verify the `ads.service` entitlement token.
export const GET: RequestHandler = async ({ locals }) => {
  await ensureSigningKey(locals.signingKeyStore);
  const r = await getJwks({ signingKeyStore: locals.signingKeyStore });
  return json(r.ok ? r.data : { keys: [] }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
};
