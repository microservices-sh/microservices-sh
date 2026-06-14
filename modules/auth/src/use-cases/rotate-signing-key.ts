import { generateEd25519KeyPair } from "../jwt";
import type { SigningKeyStore } from "../ports";
import type { SigningKey } from "../types";

// Generates a new Ed25519 keypair, retires the previous active key, and promotes
// the new one. Run once at provisioning time and on each rotation.
export async function rotateSigningKey(deps: { signingKeyStore: SigningKeyStore; now?: () => number }) {
  const nowMs = deps.now?.() ?? Date.now();
  const timestamp = new Date(nowMs).toISOString();
  const { publicJwk, privateJwk } = await generateEd25519KeyPair();

  await deps.signingKeyStore.retireActiveKeys(timestamp);

  const key: SigningKey = {
    kid: `key_${crypto.randomUUID().slice(0, 12)}`,
    algorithm: "EdDSA",
    publicJwk,
    privateJwk,
    status: "active",
    createdAt: timestamp,
    retiredAt: null
  };
  await deps.signingKeyStore.putKey(key);

  await deps.signingKeyStore.writeEvent({
    eventName: "auth.key_rotated",
    entityType: "auth",
    entityId: key.kid,
    payload: { kid: key.kid }
  });

  return { ok: true as const, status: 201 as const, data: { kid: key.kid, publicJwk } };
}
