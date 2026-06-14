import type { SigningKeyStore } from "../ports";

// Publishes public verification keys (JWKS). Other services fetch and cache this
// to verify tokens locally — the private key never leaves the auth service.
export async function getJwks(deps: { signingKeyStore: SigningKeyStore }) {
  const keys = await deps.signingKeyStore.listPublicKeys();
  return {
    ok: true as const,
    status: 200 as const,
    data: {
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
    }
  };
}
