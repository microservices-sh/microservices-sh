import { ok, err, runHooks } from "@microservices-sh/connection-contract";
import type { ResolvedHook } from "@microservices-sh/connection-contract";
import { verifyApiKey } from "./verify-api-key";
import { issueTokenInputSchema } from "../schemas";
import { beforeIssueToken } from "../hooks";
import { gatewayMeta } from "../meta";
import type { ApiKeyStore, RateLimitStore, TokenMinter } from "../ports";

export interface IssueTokenConfig {
  tokenTtlSeconds?: number;
  rateLimit?: number;
  rateWindowSeconds?: number;
}

// The inbound exchange (plans/24): authenticate the external caller's API key,
// rate-limit, narrow scopes to the key's grant, then mint a short-lived token
// via auth. The gateway never signs — it delegates to the TokenMinter, which is
// backed by the auth module's `mintToken` (embedded use-case or service binding;
// see connections.rpc.calls → auth.mintToken).
//
// Two layers of customization run before the mint:
//   1. the local config seam `beforeIssueToken` (per-app override)
//   2. the cross-module `beforeIssueToken` hook chain (Plan 25 §5), injected by
//      the composed app via deps.beforeIssueHooks — filters may narrow scopes,
//      guards may veto issuance.
export async function issueToken(
  input: unknown,
  deps: {
    apiKeyStore: ApiKeyStore;
    rateLimitStore: RateLimitStore;
    tokenMinter: TokenMinter;
    config?: IssueTokenConfig;
    correlationId?: string;
    beforeIssueHooks?: ResolvedHook[];
  }
) {
  const meta = gatewayMeta(deps);

  const parsed = issueTokenInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "gateway.INVALID_ISSUE_INPUT", message: "Issue token input is invalid.", issues: parsed.error.issues }, meta);
  }

  const auth = await verifyApiKey(parsed.data.apiKey, { apiKeyStore: deps.apiKeyStore, meta });
  if (!auth.ok) return auth;
  const principal = auth.data.principal;

  const limit = deps.config?.rateLimit ?? 60;
  const windowSeconds = deps.config?.rateWindowSeconds ?? 60;
  const rate = await deps.rateLimitStore.hit("apikey:" + principal.apiKeyId, limit, windowSeconds);
  if (!rate.allowed) {
    await deps.apiKeyStore.writeEvent({
      eventName: "gateway.access_denied",
      entityType: "gateway",
      entityId: principal.apiKeyId,
      correlationId: meta.correlationId,
      payload: { reason: "rate_limited", limit, resetAt: rate.resetAt }
    });
    return err(429, { code: "gateway.RATE_LIMITED", message: "Rate limit exceeded." }, meta);
  }

  const granted = new Set(principal.scopes);
  const requested = parsed.data.scopes ?? principal.scopes;
  const exceeded = requested.filter((scope) => !granted.has(scope));
  if (exceeded.length > 0) {
    await deps.apiKeyStore.writeEvent({
      eventName: "gateway.access_denied",
      entityType: "gateway",
      entityId: principal.apiKeyId,
      correlationId: meta.correlationId,
      payload: { reason: "scope_not_granted", exceeded }
    });
    return err(403, { code: "gateway.SCOPE_NOT_GRANTED", message: "Requested scopes exceed the API key grant.", issues: exceeded }, meta);
  }

  const draft = await beforeIssueToken({ subject: principal.subject, scopes: requested });
  if (!draft.ok || !draft.value) {
    return err(422, { code: "gateway.ISSUE_REJECTED", message: "Token issuance rejected by beforeIssueToken hook." }, meta);
  }

  const hooked = await runHooks(
    "beforeIssueToken",
    draft.value,
    { correlationId: meta.correlationId },
    deps.beforeIssueHooks ?? []
  );
  if (!hooked.ok) {
    return err(hooked.status, hooked.error, meta);
  }
  const data = hooked.value as typeof draft.value;

  const minted = await deps.tokenMinter.mint({
    subject: data.subject,
    scopes: data.scopes,
    ttlSeconds: deps.config?.tokenTtlSeconds ?? 60,
    workspace: principal.workspace,
    project: principal.project
  });
  if (!minted.ok) {
    return err(minted.status, { code: "gateway.MINT_FAILED", message: "auth.mintToken rejected the issuance.", cause: String(minted.error) }, meta);
  }

  await deps.apiKeyStore.writeEvent({
    eventName: "gateway.token_issued",
    entityType: "gateway",
    entityId: principal.apiKeyId,
    correlationId: meta.correlationId,
    payload: { subject: principal.subject, scopes: data.scopes }
  });

  return ok(200, { token: minted.token, scopes: data.scopes, claims: minted.claims }, meta);
}
