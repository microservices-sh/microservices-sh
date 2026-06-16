import { ok, err } from "@microservices-sh/connection-contract";
import { connectAccountInputSchema } from "../schemas";
import { adsManagerMeta } from "../meta";
import type { AdsStore } from "../ports";

// Record a reference to an upstream ad-account connection (the host completed
// OAuth in the upstream service and got back an externalRef). No tokens stored here.
export async function connectAccount(input: unknown, deps: { store: AdsStore; now?: () => number; correlationId?: string }) {
  const meta = adsManagerMeta(deps);
  const parsed = connectAccountInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "ads.INVALID_CONNECT_INPUT", message: "Connect input is invalid.", issues: parsed.error.issues }, meta);
  }
  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const conn = await deps.store.upsertConnection(parsed.data, nowIso);
  const event = {
    name: "ad.account_connected",
    correlationId: meta.correlationId,
    payload: { connectionId: conn.id, tenantId: conn.tenantId, platform: conn.platform, adAccountId: conn.adAccountId },
  };
  return ok(201, { connection: conn, event }, meta);
}
