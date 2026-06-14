import type { EventEnvelope } from "./types";

// HMAC-SHA256 signing/verification for queue event envelopes (plans/24 layer 3).
// Producers sign with a per-tenant secret; consumers (e.g. audit-log) verify
// origin before recording. Framework-neutral WebCrypto.

function canonical(envelope: EventEnvelope): string {
  return JSON.stringify({
    eventName: envelope.eventName,
    entityType: envelope.entityType,
    entityId: envelope.entityId,
    source: envelope.source,
    actorId: envelope.actorId ?? null,
    payload: envelope.payload,
  });
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signEnvelope(envelope: EventEnvelope, secret: string): Promise<EventEnvelope> {
  return { ...envelope, signature: await hmac(secret, canonical(envelope)) };
}

export async function verifyEnvelope(envelope: EventEnvelope, secret: string): Promise<boolean> {
  if (!envelope.signature) return false;
  const expected = await hmac(secret, canonical(envelope));
  // Constant-time-ish compare.
  if (expected.length !== envelope.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
  return diff === 0;
}
