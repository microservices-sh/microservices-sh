import { verifyApiKey } from "./verify-api-key";
import { issueTokenInputSchema } from "../schemas";
import { beforeIssueToken } from "../hooks";
import type { ApiKeyStore, RateLimitStore, TokenMinter } from "../ports";

export interface IssueTokenConfig {
  tokenTtlSeconds?: number;
  rateLimit?: number;
  rateWindowSeconds?: number;
}

// The inbound exchange (plans/24): authenticate the external caller's API key,
// rate-limit, narrow scopes to the key's grant, then mint a short-lived token
// via auth. The gateway never signs — it delegates to the TokenMinter.
export async function issueToken(
  input: unknown,
  deps: { apiKeyStore: ApiKeyStore; rateLimitStore: RateLimitStore; tokenMinter: TokenMinter; config?: IssueTokenConfig }
) {
  const parsed = issueTokenInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { code: "INVALID_ISSUE_INPUT", message: "Issue token input is invalid.", issues: parsed.error.issues }
    };
  }

  const auth = await verifyApiKey(parsed.data.apiKey, deps);
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
      payload: { reason: "rate_limited", limit, resetAt: rate.resetAt }
    });
    return { ok: false as const, status: 429 as const, error: { code: "RATE_LIMITED", message: "Rate limit exceeded.", resetAt: rate.resetAt } };
  }

  const granted = new Set(principal.scopes);
  const requested = parsed.data.scopes ?? principal.scopes;
  const exceeded = requested.filter((scope) => !granted.has(scope));
  if (exceeded.length > 0) {
    await deps.apiKeyStore.writeEvent({
      eventName: "gateway.access_denied",
      entityType: "gateway",
      entityId: principal.apiKeyId,
      payload: { reason: "scope_not_granted", exceeded }
    });
    return {
      ok: false as const,
      status: 403 as const,
      error: { code: "SCOPE_NOT_GRANTED", message: "Requested scopes exceed the API key grant.", exceeded, granted: principal.scopes }
    };
  }

  const draft = await beforeIssueToken({ subject: principal.subject, scopes: requested });
  if (!draft.ok || !draft.value) {
    return { ok: false as const, status: 422 as const, error: { code: "ISSUE_REJECTED", message: "Token issuance rejected by beforeIssueToken hook." } };
  }

  const minted = await deps.tokenMinter.mint({
    subject: draft.value.subject,
    scopes: draft.value.scopes,
    ttlSeconds: deps.config?.tokenTtlSeconds ?? 60,
    workspace: principal.workspace,
    project: principal.project
  });
  if (!minted.ok) return minted;

  await deps.apiKeyStore.writeEvent({
    eventName: "gateway.token_issued",
    entityType: "gateway",
    entityId: principal.apiKeyId,
    payload: { subject: principal.subject, scopes: draft.value.scopes }
  });

  return { ok: true as const, status: 200 as const, data: { token: minted.token, scopes: draft.value.scopes, claims: minted.claims } };
}
