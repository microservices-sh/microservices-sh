import { ok, err } from "@microservices-sh/connection-contract";
import type { Meta } from "@microservices-sh/connection-contract";
import { hashApiKey } from "../crypto";
import { gatewayMeta } from "../meta";
import type { ApiKeyStore } from "../ports";
import type { Principal } from "../types";

// Hashes the presented key and resolves the active record to a principal.
// `meta` is threaded from the caller so the correlationId stays stable across
// the verify → issue chain; when absent a fresh gateway meta is minted.
export async function verifyApiKey(
  rawKey: unknown,
  deps: { apiKeyStore: ApiKeyStore; correlationId?: string; meta?: Meta }
) {
  const meta = deps.meta ?? gatewayMeta(deps);

  if (typeof rawKey !== "string" || rawKey.length < 8) {
    return err(401, { code: "gateway.INVALID_API_KEY", message: "A valid API key is required." }, meta);
  }

  const record = await deps.apiKeyStore.getByHash(await hashApiKey(rawKey));
  if (!record || record.status !== "active") {
    return err(401, { code: "gateway.UNKNOWN_API_KEY", message: "API key is not recognized or is revoked." }, meta);
  }

  const principal: Principal = {
    subject: record.subject,
    workspace: record.workspace,
    project: record.project,
    scopes: record.scopes,
    apiKeyId: record.id
  };
  return ok(200, { principal }, meta);
}
