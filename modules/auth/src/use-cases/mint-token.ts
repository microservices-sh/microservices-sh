import { signJwt, type JwtHeader } from "../jwt";
import { mintTokenInputSchema } from "../schemas";
import type { SigningKeyStore } from "../ports";
import type { TokenClaims } from "../types";

// Mints a short-lived EdDSA JWT carrying actor + scopes. Callers (e.g. the
// gateway) request the scopes the downstream operation needs; callee services
// verify the signature and check scopes against their own permissions.
export async function mintToken(
  input: unknown,
  deps: { signingKeyStore: SigningKeyStore; now?: () => number }
) {
  const parsed = mintTokenInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_MINT_INPUT", message: "Mint token input is invalid.", issues: parsed.error.issues }
    };
  }

  const key = await deps.signingKeyStore.getActiveKey();
  if (!key) {
    return {
      ok: false as const,
      status: 500 as const,
      error: { code: "NO_ACTIVE_SIGNING_KEY", message: "No active signing key. Run rotateSigningKey first." }
    };
  }

  const nowMs = deps.now?.() ?? Date.now();
  const iat = Math.floor(nowMs / 1000);
  const claims: TokenClaims = {
    sub: parsed.data.subject,
    workspace: parsed.data.workspace,
    project: parsed.data.project,
    scopes: parsed.data.scopes,
    iss: parsed.data.issuer,
    iat,
    exp: iat + parsed.data.ttlSeconds,
    jti: `jti_${crypto.randomUUID().slice(0, 16)}`
  };

  const header: JwtHeader = { alg: "EdDSA", typ: "JWT", kid: key.kid };
  const token = await signJwt(header, claims, key.privateJwk);

  await deps.signingKeyStore.writeEvent({
    eventName: "auth.token_minted",
    entityType: "auth",
    entityId: claims.jti,
    payload: { sub: claims.sub, workspace: claims.workspace, project: claims.project, scopes: claims.scopes }
  });

  return { ok: true as const, status: 200 as const, data: { token, claims, kid: key.kid } };
}
