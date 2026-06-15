// HMAC-SHA256 signing/verification for queue event envelopes (Plan 24 layer 3).
// Ported from modules/audit-log/src/envelope.ts; canonical() now includes
// correlationId so the end-to-end trace id is tamper-protected (Plan 25 §8).
// Framework-neutral WebCrypto.

function canonical(envelope) {
  return JSON.stringify({
    eventName: envelope.eventName,
    entityType: envelope.entityType,
    entityId: envelope.entityId,
    source: envelope.source,
    actorId: envelope.actorId ?? null,
    correlationId: envelope.correlationId ?? null,
    payload: envelope.payload,
  });
}

async function hmac(secret, message) {
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

export async function signEnvelope(envelope, secret) {
  return { ...envelope, signature: await hmac(secret, canonical(envelope)) };
}

export async function verifyEnvelope(envelope, secret) {
  if (!envelope.signature) return false;
  const expected = await hmac(secret, canonical(envelope));
  // Constant-time-ish compare.
  if (expected.length !== envelope.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
  }
  return diff === 0;
}
