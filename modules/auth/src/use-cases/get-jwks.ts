import { ok } from "@microservices-sh/connection-contract";
import { authMeta } from "../meta";
import type { SigningKeyStore } from "../ports";

// Publishes public verification keys (JWKS). Other services fetch and cache this
// to verify tokens locally — the private key never leaves the auth service.
export async function getJwks(deps: { signingKeyStore: SigningKeyStore; now?: () => number; correlationId?: string }) {
  const meta = authMeta(deps);
  const keys = await deps.signingKeyStore.listPublicKeys();
  return ok(
    200,
    {
      // Construct JWKS entries explicitly from public fields only — never spread
      // a key object that could carry private material.
      keys: keys.map((key) => ({
        kty: key.publicJwk.kty,
        crv: key.publicJwk.crv,
        x: key.publicJwk.x,
        kid: key.kid,
        use: "sig",
        alg: "EdDSA"
      }))
    },
    meta
  );
}
