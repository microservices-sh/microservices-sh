import type { AdsStore, AlertFilter, ConnectionInput, SnapshotFilter } from "../ports";
import type { AdAlert, AdConnection, InsightSnapshot } from "../types";
import { snapshotId } from "../keys";

export function createMemoryAdsStore(): AdsStore {
  const connections = new Map<string, AdConnection>();
  const snapshots = new Map<string, InsightSnapshot>(); // keyed by snapshotId
  const alerts = new Map<string, AdAlert>();

  return {
    async upsertConnection(input: ConnectionInput, now: string) {
      const existing = [...connections.values()].find(
        (c) => c.tenantId === input.tenantId && c.externalRef === input.externalRef,
      );
      const conn: AdConnection = existing
        ? { ...existing, ...input, displayName: input.displayName ?? existing.displayName, status: "connected", updatedAt: now }
        : {
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
      connections.set(conn.id, conn);
      return { ...conn };
    },
    async listConnections(tenantId) {
      return [...connections.values()].filter((c) => c.tenantId === tenantId).map((c) => ({ ...c }));
    },
    async getConnection(tenantId, id) {
      const c = connections.get(id);
      return c && c.tenantId === tenantId ? { ...c } : null;
    },
    async deleteConnection(tenantId, id) {
      const c = connections.get(id);
      if (!c || c.tenantId !== tenantId) return false;
      connections.delete(id);
      return true;
    },

    async upsertSnapshots(rows) {
      for (const r of rows) snapshots.set(snapshotId(r.connectionId, r.campaignId, r.date), { ...r });
    },
    async listSnapshots(filter: SnapshotFilter) {
      return [...snapshots.values()]
        .filter((s) => s.tenantId === filter.tenantId)
        .filter((s) => !filter.connectionId || s.connectionId === filter.connectionId)
        .filter((s) => !filter.campaignId || s.campaignId === filter.campaignId)
        .filter((s) => !filter.since || s.date >= filter.since)
        .filter((s) => !filter.until || s.date <= filter.until)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, filter.limit ?? 1000)
        .map((s) => ({ ...s }));
    },

    async insertAlert(alert) {
      alerts.set(alert.id, { ...alert });
    },
    async findAlert(tenantId, connectionId, campaignId, type, date) {
      return (
        [...alerts.values()].find(
          (a) => a.tenantId === tenantId && a.connectionId === connectionId && a.campaignId === campaignId && a.type === type && a.date === date,
        ) ?? null
      );
    },
    async listAlerts(filter: AlertFilter) {
      return [...alerts.values()]
        .filter((a) => a.tenantId === filter.tenantId)
        .filter((a) => filter.acknowledged === undefined || (filter.acknowledged ? a.acknowledgedAt !== null : a.acknowledgedAt === null))
        .sort((a, b) => b.firedAt.localeCompare(a.firedAt))
        .slice(0, filter.limit ?? 100)
        .map((a) => ({ ...a }));
    },
  };
}
