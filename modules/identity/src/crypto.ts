// WebCrypto helpers — work on Cloudflare Workers and Node 22+ (global crypto.subtle).
// Same runtime guarantee @microservices-sh/auth's jwt.ts relies on.

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// Uniform random numeric code (rejection-sampled to avoid modulo bias).
export function randomCode(digits: number): string {
  const max = 10 ** digits;
  const limit = Math.floor(0xffffffff / max) * max; // largest multiple of max <= 2^32
  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return String(n % max).padStart(digits, "0");
}

// Opaque session id — 256 bits of entropy.
export function randomId(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return hex(buf);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(new Uint8Array(digest));
}

// Constant-time comparison of two equal-length hex strings (timing-safe code check).
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
