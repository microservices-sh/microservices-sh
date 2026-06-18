import { ok, err } from "@microservices-sh/connection-contract";
import { decodeJwt, verifyJwtSignature } from "../jwt";
import { verifyTokenInputSchema } from "../schemas";
import { authMeta } from "../meta";
import type { SigningKeyStore } from "../ports";
import type { TokenClaims } from "../types";

interface VerifyTokenDeps {
  signingKeyStore: SigningKeyStore;
  now?: () => number;
  correlationId?: string;
  expectedIssuer?: string;
  expectedWorkspace?: string;
  expectedProject?: string;
}

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
// expiry. Optional expected issuer/workspace/project checks bind the token to
// the receiving app context so call sites do not need to remember to compare
// ambient tenant/project identifiers after verification.
export async function verifyToken(
  input: unknown,
  deps: VerifyTokenDeps
) {
  const meta = authMeta(deps);

  const parsed = verifyTokenInputSchema.safeParse(typeof input === "string" ? { token: input } : input);
  if (!parsed.success) {
    return err(400, { code: "auth.INVALID_VERIFY_INPUT", message: "Verify token input is invalid.", issues: parsed.error.issues }, meta);
  }

  const decoded = decodeJwt(parsed.data.token);
  if (!decoded || !decoded.header.kid) {
    return err(401, { code: "auth.MALFORMED_TOKEN", message: "Token is malformed." }, meta);
  }

  const key = await deps.signingKeyStore.getKey(decoded.header.kid);
  if (!key) {
    return err(401, { code: "auth.UNKNOWN_KEY", message: "Token kid is not recognized." }, meta);
  }

  const validSignature = await verifyJwtSignature(parsed.data.token, key.publicJwk);
  if (!validSignature) {
    return err(401, { code: "auth.INVALID_SIGNATURE", message: "Token signature is invalid." }, meta);
  }

  const claims = asClaims(decoded.payload);
  if (!claims) {
    return err(401, { code: "auth.INVALID_CLAIMS", message: "Token claims are incomplete." }, meta);
  }

  const nowSeconds = Math.floor((deps.now?.() ?? Date.now()) / 1000);
  if (claims.exp <= nowSeconds) {
    return err(401, { code: "auth.TOKEN_EXPIRED", message: "Token has expired." }, meta);
  }
  if (deps.expectedIssuer && claims.iss !== deps.expectedIssuer) {
    return err(401, { code: "auth.INVALID_ISSUER", message: "Token issuer does not match the expected issuer." }, meta);
  }
  if (deps.expectedWorkspace && claims.workspace !== deps.expectedWorkspace) {
    return err(401, { code: "auth.INVALID_WORKSPACE", message: "Token workspace does not match the expected workspace." }, meta);
  }
  if (deps.expectedProject && claims.project !== deps.expectedProject) {
    return err(401, { code: "auth.INVALID_PROJECT", message: "Token project does not match the expected project." }, meta);
  }

  return ok(200, { claims }, meta);
}
