import { getJwks, rotateSigningKey } from "@microservices-sh/auth";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";

// Ensure the app has at least one signing key. Passwordless identity sessions do
// not mint JWT keys, so the store can be empty until the public JWKS is first
// requested — rotate one in on demand so /api/auth/jwks always has a key to serve.
export async function ensureSigningKey(store: SigningKeyStore): Promise<void> {
  const jwks = await getJwks({ signingKeyStore: store });
  const keys = jwks.ok ? (jwks.data as { keys?: unknown[] }).keys : undefined;
  if (!keys || keys.length === 0) await rotateSigningKey({ signingKeyStore: store });
}
