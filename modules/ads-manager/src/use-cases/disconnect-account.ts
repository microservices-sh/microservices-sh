import { ok, err } from "@microservices-sh/connection-contract";
import { connectionRefSchema } from "../schemas";
import { adsManagerMeta } from "../meta";
import type { AdsStore } from "../ports";

export async function disconnectAccount(input: unknown, deps: { store: AdsStore; correlationId?: string }) {
  const meta = adsManagerMeta(deps);
  const parsed = connectionRefSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "ads.INVALID_INPUT", message: "Disconnect input is invalid.", issues: parsed.error.issues }, meta);
  }
  const removed = await deps.store.deleteConnection(parsed.data.tenantId, parsed.data.connectionId);
  if (!removed) {
    return err(404, { code: "ads.CONNECTION_NOT_FOUND", message: "Connection not found." }, meta);
  }
  const event = {
    name: "ad.account_disconnected",
    correlationId: meta.correlationId,
    payload: { connectionId: parsed.data.connectionId, tenantId: parsed.data.tenantId },
  };
  return ok(200, { ok: true, event }, meta);
}
