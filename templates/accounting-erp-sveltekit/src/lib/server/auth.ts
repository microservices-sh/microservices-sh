import { getJwks, rotateSigningKey } from "@microservices-sh/auth";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";

// Lazily ensure the auth module has at least one signing key, rotating one in on
// first use. Keeps the public JWKS endpoint self-healing in local dev without a
// separate key-provisioning step.
export async function ensureSigningKey(store: SigningKeyStore): Promise<void> {
  const jwks = await getJwks({ signingKeyStore: store });
  const keys = jwks.ok ? (jwks.data as { keys?: unknown[] }).keys : undefined;
  if (!keys || keys.length === 0) await rotateSigningKey({ signingKeyStore: store });
}
