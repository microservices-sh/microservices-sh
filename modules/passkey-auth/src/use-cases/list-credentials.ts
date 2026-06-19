import { ok, err } from "@microservices-sh/connection-contract";
import { passkeyMeta } from "../meta";
import type { PasskeyStore } from "../ports";
import type { CredentialSummary } from "../types";

export interface ListCredentialsDeps {
  store: PasskeyStore;
  now?: () => number;
  correlationId?: string;
}

export interface ListCredentialsInput {
  userId: string;
}

// Session-gated. Return the requesting user's registered passkeys as summaries — never
// the public key or signature counter.
export async function listCredentials(input: ListCredentialsInput, deps: ListCredentialsDeps) {
  const meta = passkeyMeta(deps);
  const userId = String(input?.userId ?? "").trim();
  if (!userId) {
    return err(400, { code: "passkey.INVALID_INPUT", message: "An authenticated user id is required." }, meta);
  }

  const creds = await deps.store.getCredentialsByUser(userId);
  const credentials: CredentialSummary[] = creds
    .map((c) => ({ id: c.id, credentialId: c.credentialId, name: c.name, createdAt: c.createdAt, lastUsedAt: c.lastUsedAt }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return ok(200, { credentials }, meta);
}
