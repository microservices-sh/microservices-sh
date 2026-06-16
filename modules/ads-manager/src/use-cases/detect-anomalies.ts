import { ok, err } from "@microservices-sh/connection-contract";
import { detectAnomaliesInputSchema } from "../schemas";
import { defaultConfig } from "../config";
import { onAlertRaised } from "../hooks";
import { adsManagerMeta } from "../meta";
import type { AdsStore, Entitlement } from "../ports";
import type { AdAlert, AlertSeverity, AlertType, InsightSnapshot } from "../types";

export interface DetectAnomaliesDeps {
  store: AdsStore;
  entitlement: Entitlement;
  config?: Partial<typeof defaultConfig>;
  now?: () => number;
  correlationId?: string;
}

function isoDateMinusDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// Compare each campaign's metrics for `date` against its trailing-window baseline
// and raise typed alerts. Idempotent: an alert is unique per (campaign, type, day).
export async function detectAnomalies(input: unknown, deps: DetectAnomaliesDeps) {
  const meta = adsManagerMeta(deps);
  const parsed = detectAnomaliesInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "ads.INVALID_INPUT", message: "Input is invalid.", issues: parsed.error.issues }, meta);
  }

  const entitled = await deps.entitlement.check(parsed.data.tenantId);
  if (!entitled.active) {
    return err(402, { code: "ads.NOT_ENTITLED", message: entitled.reason ?? "Active ads subscription required ($1.90/mo)." }, meta);
  }

  const conn = await deps.store.getConnection(parsed.data.tenantId, parsed.data.connectionId);
  if (!conn) return err(404, { code: "ads.CONNECTION_NOT_FOUND", message: "Connection not found." }, meta);

  const cfg = { ...defaultConfig, ...deps.config };
  const until = parsed.data.date;
  const since = isoDateMinusDays(until, cfg.baselineWindowDays);
  const snaps = await deps.store.listSnapshots({ tenantId: conn.tenantId, connectionId: conn.id, since, until, limit: 5000 });

  const today = snaps.filter((s) => s.date === until);
  const prior = snaps.filter((s) => s.date < until);
  const priorByCampaign = new Map<string, InsightSnapshot[]>();
  for (const s of prior) {
    const arr = priorByCampaign.get(s.campaignId) ?? [];
    arr.push(s);
    priorByCampaign.set(s.campaignId, arr);
  }

  const nowMs = deps.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const raised: AdAlert[] = [];

  function candidate(s: InsightSnapshot, type: AlertType, severity: AlertSeverity, message: string, before: number | null, after: number | null) {
    return { s, type, severity, message, before, after };
  }

  for (const s of today) {
    const base = priorByCampaign.get(s.campaignId) ?? [];
    const avgSpend = mean(base.map((b) => b.spendCents));
    const avgCpc = mean(base.map((b) => b.cpcCents));
    const cands: ReturnType<typeof candidate>[] = [];

    if (avgSpend > 0 && s.spendCents >= cfg.spendSpikeMultiplier * avgSpend) {
      cands.push(candidate(s, "spend_spike", "critical", `${s.campaignName ?? s.campaignId} spend ${(s.spendCents / Math.max(avgSpend, 1)).toFixed(1)}× trailing avg`, avgSpend, s.spendCents));
    }
    if (avgCpc > 0 && s.cpcCents >= cfg.cpcSpikeMultiplier * avgCpc) {
      cands.push(candidate(s, "cpc_spike", "warning", `${s.campaignName ?? s.campaignId} CPC ${(s.cpcCents / Math.max(avgCpc, 1)).toFixed(1)}× trailing avg`, avgCpc, s.cpcCents));
    }
    if (s.spendCents >= cfg.zeroConvMinSpendCents && s.conversions === 0) {
      cands.push(candidate(s, "zero_conv", "warning", `${s.campaignName ?? s.campaignId} spent with zero conversions`, 0, s.spendCents));
    }

    for (const c of cands) {
      const existing = await deps.store.findAlert(conn.tenantId, conn.id, s.campaignId, c.type, until);
      if (existing) continue;
      const alert: AdAlert = {
        id: "alr_" + crypto.randomUUID().slice(0, 16),
        tenantId: conn.tenantId,
        connectionId: conn.id,
        campaignId: s.campaignId,
        type: c.type,
        severity: c.severity,
        message: c.message,
        metricBefore: c.before,
        metricAfter: c.after,
        date: until,
        firedAt: nowIso,
        acknowledgedAt: null,
      };
      await deps.store.insertAlert(alert);
      await onAlertRaised(alert);
      raised.push(alert);
    }
  }

  const event = raised.length
    ? { name: "ad.alert_raised", correlationId: meta.correlationId, payload: { connectionId: conn.id, tenantId: conn.tenantId, date: until, count: raised.length } }
    : undefined;
  return ok(200, { alerts: raised, count: raised.length, event }, meta);
}
