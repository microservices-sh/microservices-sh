// Framework-neutral EdDSA (Ed25519) JWT primitives built on WebCrypto.
// Works on Cloudflare Workers and Node 22+ (global crypto.subtle).
// No third-party JWT dependency: keeps the module surface auditable.

const ALG = { name: "Ed25519" } as const;

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? textToBytes(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function base64UrlDecodeToString(input: string): string {
  return new TextDecoder().decode(base64UrlDecode(input));
}

export interface Ed25519KeyMaterial {
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}

export async function generateEd25519KeyPair(): Promise<Ed25519KeyMaterial> {
  const pair = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const privateJwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return { publicJwk, privateJwk };
}

async function importSigningKey(privateJwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", privateJwk, ALG, false, ["sign"]);
}

async function importVerifyKey(publicJwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", publicJwk, ALG, false, ["verify"]);
}

export interface JwtHeader {
  alg: "EdDSA";
  typ: "JWT";
  kid: string;
}

export async function signJwt(
  header: JwtHeader,
  payload: object,
  privateJwk: JsonWebKey
): Promise<string> {
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await importSigningKey(privateJwk);
  const signature = await crypto.subtle.sign(ALG, key, textToBytes(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export interface DecodedJwt {
  header: JwtHeader;
  payload: Record<string, unknown>;
}

export function decodeJwt(token: string): DecodedJwt | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return {
      header: JSON.parse(base64UrlDecodeToString(parts[0])) as JwtHeader,
      payload: JSON.parse(base64UrlDecodeToString(parts[1])) as Record<string, unknown>
    };
  } catch {
    return null;
  }
}

export async function verifyJwtSignature(token: string, publicJwk: JsonWebKey): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const signingInput = `${parts[0]}.${parts[1]}`;
  const key = await importVerifyKey(publicJwk);
  return crypto.subtle.verify(ALG, key, base64UrlDecode(parts[2]), textToBytes(signingInput));
}
