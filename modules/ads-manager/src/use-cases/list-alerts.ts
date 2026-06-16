import { ok, err } from "@microservices-sh/connection-contract";
import { listAlertsInputSchema } from "../schemas";
import { adsManagerMeta } from "../meta";
import type { AdsStore } from "../ports";

export async function listAlerts(input: unknown, deps: { store: AdsStore; correlationId?: string }) {
  const meta = adsManagerMeta(deps);
  const parsed = listAlertsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "ads.INVALID_INPUT", message: "Alert filter is invalid.", issues: parsed.error.issues }, meta);
  }
  const alerts = await deps.store.listAlerts(parsed.data);
  return ok(200, { alerts, count: alerts.length }, meta);
}
