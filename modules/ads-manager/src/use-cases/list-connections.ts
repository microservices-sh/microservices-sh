import { ok, err } from "@microservices-sh/connection-contract";
import { tenantOnlySchema } from "../schemas";
import { adsManagerMeta } from "../meta";
import type { AdsStore } from "../ports";

export async function listConnections(input: unknown, deps: { store: AdsStore; correlationId?: string }) {
  const meta = adsManagerMeta(deps);
  const parsed = tenantOnlySchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "ads.INVALID_INPUT", message: "tenantId is required.", issues: parsed.error.issues }, meta);
  }
  const connections = await deps.store.listConnections(parsed.data.tenantId);
  return ok(200, { connections, count: connections.length }, meta);
}
