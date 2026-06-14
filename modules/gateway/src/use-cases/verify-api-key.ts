import { hashApiKey } from "../crypto";
import type { ApiKeyStore } from "../ports";
import type { Principal } from "../types";

// Hashes the presented key and resolves the active record to a principal.
export async function verifyApiKey(rawKey: unknown, deps: { apiKeyStore: ApiKeyStore }) {
  if (typeof rawKey !== "string" || rawKey.length < 8) {
    return { ok: false as const, status: 401 as const, error: { code: "INVALID_API_KEY", message: "A valid API key is required." } };
  }

  const record = await deps.apiKeyStore.getByHash(await hashApiKey(rawKey));
  if (!record || record.status !== "active") {
    return { ok: false as const, status: 401 as const, error: { code: "UNKNOWN_API_KEY", message: "API key is not recognized or is revoked." } };
  }

  const principal: Principal = {
    subject: record.subject,
    workspace: record.workspace,
    project: record.project,
    scopes: record.scopes,
    apiKeyId: record.id
  };
  return { ok: true as const, status: 200 as const, data: { principal } };
}
