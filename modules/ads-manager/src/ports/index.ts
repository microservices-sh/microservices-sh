import type {
  AdConnection,
  AdAlert,
  AdPlatform,
  ConnectorContext,
  DateRange,
  InsightRow,
  InsightSnapshot,
  NormalizedCampaign,
} from "../types";

// Connector to the upstream ads service (openclaw). Platform apps/OAuth/tokens
// live upstream; this talks to its normalized M2M API, carrying the entitlement.
export interface AdsConnector {
  listCampaigns(ctx: ConnectorContext, externalRef: string, range: DateRange): Promise<NormalizedCampaign[]>;
  getInsights(ctx: ConnectorContext, externalRef: string, range: DateRange): Promise<InsightRow[]>;
  // Optional: register the calling tenant's grant for a connection with the
  // upstream service. Required before reads when the upstream enforces grants
  // (the openclaw connector); no-op connectors (memory) omit it.
  grantConnection?(ctx: ConnectorContext, externalRef: string): Promise<void>;
}

export interface ConnectionInput {
  tenantId: string;
  platform: AdPlatform;
  adAccountId: string;
  displayName?: string | null;
  externalRef: string;
}

export interface SnapshotFilter {
  tenantId: string;
  connectionId?: string;
  campaignId?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export interface AlertFilter {
  tenantId: string;
  acknowledged?: boolean;
  limit?: number;
}

// Persistence (D1 or in-memory).
export interface AdsStore {
  upsertConnection(input: ConnectionInput, now: string): Promise<AdConnection>;
  listConnections(tenantId: string): Promise<AdConnection[]>;
  getConnection(tenantId: string, id: string): Promise<AdConnection | null>;
  deleteConnection(tenantId: string, id: string): Promise<boolean>;

  upsertSnapshots(rows: InsightSnapshot[]): Promise<void>;
  listSnapshots(filter: SnapshotFilter): Promise<InsightSnapshot[]>;

  insertAlert(alert: AdAlert): Promise<void>;
  findAlert(tenantId: string, connectionId: string, campaignId: string, type: AdAlert["type"], date: string): Promise<AdAlert | null>;
  listAlerts(filter: AlertFilter): Promise<AdAlert[]>;
}

// Entitlement gate — the host implements this against billing-subscriptions
// (the $1.90/mo ads plan). Returns whether the tenant may use the paid service.
export interface Entitlement {
  check(tenantId: string): Promise<{ active: boolean; reason?: string }>;
}
