// Canonical per-tenant ops-access token codec (Plan 32, P1).
//
// SINGLE SOURCE OF TRUTH for the token wire format. The minter (control-plane
// provisioning) and the verifier (the client's operate app) both import this, so
// mint and verify can never drift. Stateless HMAC-SHA256 over Web Crypto — runs on
// Cloudflare Workers and Node (and the raw-node CLI), no DB lookup on the hot path.
// The signing secret is per-tenant: a leaked token's blast radius is one client,
// and rotating that tenant's secret invalidates it.
//
// Authored as .js + .d.ts (like connection-contract) so it is consumable by the
// bundler/vitest TS modules AND the raw-node CLI without a build step.

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlText = (text) => b64url(enc.encode(text));

async function hmac(secret, payload) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(new Uint8Array(sig));
}

// Constant-time string compare — avoids leaking signature bytes via timing.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function mintOpsToken(claims, deps) {
  const payload = b64urlText(JSON.stringify(claims));
  const sig = await hmac(deps.secret, payload);
  return `${payload}.${sig}`;
}

export function createOpsTokenVerifier(deps) {
  return {
    async verify(token) {
      const parts = token.split(".");
      if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false };
      const [payload, sig] = parts;

      const expected = await hmac(deps.secret, payload);
      if (!timingSafeEqual(sig, expected)) return { ok: false };

      let claims;
      try {
        claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
      } catch {
        return { ok: false };
      }
      if (typeof claims?.ownerId !== "string" || !Array.isArray(claims.scopes) || typeof claims.exp !== "number") return { ok: false };
      if (claims.exp <= deps.now()) return { ok: false };

      return { ok: true, ownerId: claims.ownerId, scopes: claims.scopes };
    }
  };
}
