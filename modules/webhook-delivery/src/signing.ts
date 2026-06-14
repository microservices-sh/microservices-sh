// HMAC-SHA256 payload signing for outbound webhooks (plans/24 layer 3, external
// twin). Mirrors the audit-log envelope HMAC pattern but signs the raw outbound
// JSON body so the external receiver can verify origin with the per-endpoint
// secret. Framework-neutral WebCrypto.

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
}

export async function verifyPayload(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await signPayload(payload, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export function generateEndpointSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "whk_" + [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
