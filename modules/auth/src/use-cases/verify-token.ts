import { decodeJwt, verifyJwtSignature } from "../jwt";
import { verifyTokenInputSchema } from "../schemas";
import type { SigningKeyStore } from "../ports";
import type { TokenClaims } from "../types";

function asClaims(payload: Record<string, unknown>): TokenClaims | null {
  if (
    typeof payload.sub !== "string" ||
    typeof payload.workspace !== "string" ||
    typeof payload.project !== "string" ||
    typeof payload.iss !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    typeof payload.jti !== "string" ||
    !Array.isArray(payload.scopes)
  ) {
    return null;
  }
  return payload as unknown as TokenClaims;
}

// Verifies a token's signature against the published key for its kid and checks
// expiry. Returns the claims so the callee can run its own scope check.
export async function verifyToken(
  input: unknown,
  deps: { signingKeyStore: SigningKeyStore; now?: () => number }
) {
  const parsed = verifyTokenInputSchema.safeParse(typeof input === "string" ? { token: input } : input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_VERIFY_INPUT", message: "Verify token input is invalid.", issues: parsed.error.issues }
    };
  }

  const decoded = decodeJwt(parsed.data.token);
  if (!decoded || !decoded.header.kid) {
    return { ok: false as const, status: 401 as const, error: { code: "MALFORMED_TOKEN", message: "Token is malformed." } };
  }

  const key = await deps.signingKeyStore.getKey(decoded.header.kid);
  if (!key) {
    return { ok: false as const, status: 401 as const, error: { code: "UNKNOWN_KEY", message: "Token kid is not recognized." } };
  }

  const validSignature = await verifyJwtSignature(parsed.data.token, key.publicJwk);
  if (!validSignature) {
    return { ok: false as const, status: 401 as const, error: { code: "INVALID_SIGNATURE", message: "Token signature is invalid." } };
  }

  const claims = asClaims(decoded.payload);
  if (!claims) {
    return { ok: false as const, status: 401 as const, error: { code: "INVALID_CLAIMS", message: "Token claims are incomplete." } };
  }

  const nowSeconds = Math.floor((deps.now?.() ?? Date.now()) / 1000);
  if (claims.exp <= nowSeconds) {
    return { ok: false as const, status: 401 as const, error: { code: "TOKEN_EXPIRED", message: "Token has expired." } };
  }

  return { ok: true as const, status: 200 as const, data: { claims } };
}
