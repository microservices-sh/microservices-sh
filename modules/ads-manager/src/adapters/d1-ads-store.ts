import type { AdsStore, AlertFilter, ConnectionInput, SnapshotFilter } from "../ports";
import type { AdAlert, AdConnection, AdPlatform, AlertSeverity, AlertType, InsightSnapshot } from "../types";
import { snapshotId } from "../keys";

const CONN_COLS = "id, tenant_id, platform, ad_account_id, display_name, status, external_ref, created_at, updated_at";
const SNAP_COLS =
  "id, connection_id, tenant_id, platform, campaign_id, campaign_name, date, spend_cents, impressions, clicks, conversions, ctr, cpc_cents, roas, raw, created_at";
const ALERT_COLS =
  "id, tenant_id, connection_id, campaign_id, type, severity, message, metric_before, metric_after, date, fired_at, acknowledged_at";

function rowToConn(r: Record<string, unknown>): AdConnection {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    platform: String(r.platform) as AdPlatform,
    adAccountId: String(r.ad_account_id),
    displayName: r.display_name == null ? null : String(r.display_name),
    status: String(r.status) as AdConnection["status"],
    externalRef: String(r.external_ref),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function rowToSnap(r: Record<string, unknown>): InsightSnapshot {
  return {
    id: String(r.id),
    connectionId: String(r.connection_id),
    tenantId: String(r.tenant_id),
    platform: String(r.platform) as AdPlatform,
    campaignId: String(r.campaign_id),
    campaignName: r.campaign_name == null ? undefined : String(r.campaign_name),
    date: String(r.date),
    spendCents: Number(r.spend_cents ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    conversions: Number(r.conversions ?? 0),
    ctr: Number(r.ctr ?? 0),
    cpcCents: Number(r.cpc_cents ?? 0),
    roas: r.roas == null ? undefined : Number(r.roas),
    raw: r.raw == null ? null : String(r.raw),
    createdAt: String(r.created_at),
  };
}

function rowToAlert(r: Record<string, unknown>): AdAlert {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    connectionId: String(r.connection_id),
    campaignId: String(r.campaign_id),
    type: String(r.type) as AlertType,
    severity: String(r.severity) as AlertSeverity,
    message: String(r.message),
    metricBefore: r.metric_before == null ? null : Number(r.metric_before),
    metricAfter: r.metric_after == null ? null : Number(r.metric_after),
    date: String(r.date),
    firedAt: String(r.fired_at),
    acknowledgedAt: r.acknowledged_at == null ? null : String(r.acknowledged_at),
  };
}

export function createD1AdsStore(db: D1Database): AdsStore {
  return {
    async upsertConnection(input: ConnectionInput, now: string) {
      const existing = await db
        .prepare(`SELECT ${CONN_COLS} FROM ad_connections WHERE tenant_id = ? AND external_ref = ?`)
        .bind(input.tenantId, input.externalRef)
        .first<Record<string, unknown>>();
      if (existing) {
        const conn = { ...rowToConn(existing), platform: input.platform, adAccountId: input.adAccountId, displayName: input.displayName ?? rowToConn(existing).displayName, status: "connected" as const, updatedAt: now };
        await db
          .prepare("UPDATE ad_connections SET platform=?, ad_account_id=?, display_name=?, status='connected', updated_at=? WHERE id=?")
          .bind(conn.platform, conn.adAccountId, conn.displayName, now, conn.id)
          .run();
        return conn;
      }
      const conn: AdConnection = {
        id: "adc_" + crypto.randomUUID().slice(0, 16),
        tenantId: input.tenantId,
        platform: input.platform,
        adAccountId: input.adAccountId,
        displayName: input.displayName ?? null,
        status: "connected",
        externalRef: input.externalRef,
        createdAt: now,
        updatedAt: now,
      };
      await db
        .prepare(`INSERT INTO ad_connections (${CONN_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(conn.id, conn.tenantId, conn.platform, conn.adAccountId, conn.displayName, conn.status, conn.externalRef, conn.createdAt, conn.updatedAt)
        .run();
      return conn;
    },
    async listConnections(tenantId) {
      const r = await db.prepare(`SELECT ${CONN_COLS} FROM ad_connections WHERE tenant_id = ? ORDER BY created_at DESC`).bind(tenantId).all<Record<string, unknown>>();
      return (r.results ?? []).map(rowToConn);
    },
    async getConnection(tenantId, id) {
      const r = await db.prepare(`SELECT ${CONN_COLS} FROM ad_connections WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
      return r ? rowToConn(r) : null;
    },
    async deleteConnection(tenantId, id) {
      const r = await db.prepare("DELETE FROM ad_connections WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
      return (r.meta?.changes ?? 0) > 0;
    },

    async upsertSnapshots(rows) {
      const stmt = db.prepare(
        `INSERT INTO ad_insight_snapshots (${SNAP_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(connection_id, campaign_id, date) DO UPDATE SET
           spend_cents=excluded.spend_cents, impressions=excluded.impressions, clicks=excluded.clicks,
           conversions=excluded.conversions, ctr=excluded.ctr, cpc_cents=excluded.cpc_cents,
           roas=excluded.roas, raw=excluded.raw, campaign_name=excluded.campaign_name`,
      );
      const batch = rows.map((s) =>
        stmt.bind(
          snapshotId(s.connectionId, s.campaignId, s.date), s.connectionId, s.tenantId, s.platform, s.campaignId,
          s.campaignName ?? null, s.date, s.spendCents, s.impressions, s.clicks, s.conversions, s.ctr, s.cpcCents,
          s.roas ?? null, s.raw ?? null, s.createdAt,
        ),
      );
      if (batch.length) await db.batch(batch);
    },
    async listSnapshots(filter: SnapshotFilter) {
      const where = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.connectionId) { where.push("connection_id = ?"); binds.push(filter.connectionId); }
      if (filter.campaignId) { where.push("campaign_id = ?"); binds.push(filter.campaignId); }
      if (filter.since) { where.push("date >= ?"); binds.push(filter.since); }
      if (filter.until) { where.push("date <= ?"); binds.push(filter.until); }
      binds.push(filter.limit ?? 1000);
      const r = await db
        .prepare(`SELECT ${SNAP_COLS} FROM ad_insight_snapshots WHERE ${where.join(" AND ")} ORDER BY date DESC LIMIT ?`)
        .bind(...binds)
        .all<Record<string, unknown>>();
      return (r.results ?? []).map(rowToSnap);
    },

    async insertAlert(alert) {
      await db
        .prepare(`INSERT OR IGNORE INTO ad_alerts (${ALERT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(alert.id, alert.tenantId, alert.connectionId, alert.campaignId, alert.type, alert.severity, alert.message, alert.metricBefore, alert.metricAfter, alert.date, alert.firedAt, alert.acknowledgedAt)
        .run();
    },
    async findAlert(connectionId, campaignId, type, date) {
      const r = await db
        .prepare(`SELECT ${ALERT_COLS} FROM ad_alerts WHERE connection_id=? AND campaign_id=? AND type=? AND date=?`)
        .bind(connectionId, campaignId, type, date)
        .first<Record<string, unknown>>();
      return r ? rowToAlert(r) : null;
    },
    async listAlerts(filter: AlertFilter) {
      const where = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (filter.acknowledged !== undefined) where.push(filter.acknowledged ? "acknowledged_at IS NOT NULL" : "acknowledged_at IS NULL");
      binds.push(filter.limit ?? 100);
      const r = await db
        .prepare(`SELECT ${ALERT_COLS} FROM ad_alerts WHERE ${where.join(" AND ")} ORDER BY fired_at DESC LIMIT ?`)
        .bind(...binds)
        .all<Record<string, unknown>>();
      return (r.results ?? []).map(rowToAlert);
    },
  };
}
