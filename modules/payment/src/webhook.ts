// Stripe-style webhook signature verification (HMAC-SHA256). Framework-neutral
// WebCrypto. Stripe signs `${timestamp}.${payload}` with the endpoint's webhook
// secret and sends it as `t=...,v1=...` in the `Stripe-Signature` header. We
// recompute the HMAC and compare in constant time before trusting the event.

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(signature);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Parse a `t=...,v1=...` Stripe-Signature header into its parts.
function parseSignatureHeader(header: string): { timestamp: string | null; signatures: string[] } {
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [field, value] = part.split("=");
    if (field === "t") timestamp = value ?? null;
    if (field === "v1" && value) signatures.push(value);
  }
  return { timestamp, signatures };
}

// Produce a valid signature header for a payload — used by the Stripe gateway's
// callers and by tests to generate correctly-signed webhook bodies.
export async function signWebhook(payload: string, secret: string, timestamp: number): Promise<string> {
  const v1 = await hmacHex(secret, `${timestamp}.${payload}`);
  return `t=${timestamp},v1=${v1}`;
}

// Returns true only if the header carries a v1 signature matching the payload
// under the secret. Constant-time compare; no timestamp tolerance enforcement
// here (callers may add one) to keep the primitive deterministic for tests.
export async function verifyWebhookSignature(
  payload: string,
  header: string,
  secret: string
): Promise<boolean> {
  if (!header) return false;
  const { timestamp, signatures } = parseSignatureHeader(header);
  if (!timestamp || signatures.length === 0) return false;
  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  return signatures.some((candidate) => constantTimeEqual(expected, candidate));
}
