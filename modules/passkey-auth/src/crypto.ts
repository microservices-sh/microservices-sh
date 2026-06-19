// WebCrypto + base64url helpers — work on Cloudflare Workers and Node 22+ (global
// crypto / crypto.subtle). Public keys are stored base64url so they round-trip through
// D1's TEXT columns. Mirrors the helpers in api/src/passkey.ts.

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// Internal credential id (opaque), 64 bits of entropy as hex with a prefix.
export function newId(prefix: string): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return `${prefix}_${hex(buf)}`;
}

export function uint8ToBase64url(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToUint8(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
