import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getJwks } from "@microservices-sh/auth";

// Public JWKS so other services can verify tokens with the public key.
export const GET: RequestHandler = async ({ locals }) => {
  const result = await getJwks({ signingKeyStore: locals.signingKeyStore });
  return json(result.data);
};
