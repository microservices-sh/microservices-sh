// Framework-neutral API-key primitives (WebCrypto). Keys are stored only as a
// SHA-256 hash; the raw value is shown once at creation and never persisted.

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashApiKey(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return toHex(digest);
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "msk_" + [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
