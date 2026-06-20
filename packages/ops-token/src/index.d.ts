export type OpsTokenClaims = { ownerId: string; scopes: string[]; exp: number };

export type OpsTokenVerifyResult = { ok: true; ownerId: string; scopes: string[] } | { ok: false };

export interface OpsTokenVerifier {
  verify(token: string): Promise<OpsTokenVerifyResult>;
}

export function mintOpsToken(claims: OpsTokenClaims, deps: { secret: string }): Promise<string>;

export function createOpsTokenVerifier(deps: { secret: string; now: () => number }): OpsTokenVerifier;
