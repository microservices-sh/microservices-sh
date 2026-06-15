import { ok, err } from "@microservices-sh/connection-contract";
import { generateApiKey, hashApiKey } from "../crypto";
import { createApiKeyInputSchema } from "../schemas";
import { gatewayMeta } from "../meta";
import type { ApiKeyStore } from "../ports";
import type { ApiKeyRecord } from "../types";

// Admin operation. Generates a key, stores only its hash, and returns the raw
// key exactly once. Requires the gateway.admin scope at the route layer.
export async function createApiKey(
  input: unknown,
  deps: { apiKeyStore: ApiKeyStore; now?: () => number; correlationId?: string }
) {
  const meta = gatewayMeta(deps);

  const parsed = createApiKeyInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "gateway.INVALID_API_KEY_INPUT", message: "API key input is invalid.", issues: parsed.error.issues }, meta);
  }

  const raw = generateApiKey();
  const record: ApiKeyRecord = {
    id: "key_" + crypto.randomUUID().slice(0, 12),
    hash: await hashApiKey(raw),
    workspace: parsed.data.workspace,
    project: parsed.data.project,
    subject: parsed.data.subject,
    scopes: parsed.data.scopes,
    status: "active",
    createdAt: new Date(deps.now?.() ?? Date.now()).toISOString()
  };
  await deps.apiKeyStore.putApiKey(record);

  return ok(201, { id: record.id, apiKey: raw, scopes: record.scopes, workspace: record.workspace, project: record.project }, meta);
}
