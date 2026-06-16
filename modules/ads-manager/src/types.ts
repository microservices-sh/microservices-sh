// Ads Manager domain types. Platform apps/OAuth/tokens live in the upstream ads
// service (e.g. openclaw); this module stores a connection *reference* + insight
// snapshots, and runs the monitoring/alerting layer. All money is in cents.

export type AdPlatform = "meta" | "google";
export type AdConnectionStatus = "connected" | "disconnected" | "error";
export type CampaignStatus = "active" | "paused" | "archived" | "unknown";

// A tenant's link to an upstream ad account. `externalRef` is the upstream
// service's connection id — this module never holds platform tokens.
export interface AdConnection {
  id: string;
  tenantId: string;
  platform: AdPlatform;
  adAccountId: string;
  displayName: string | null;
  status: AdConnectionStatus;
  externalRef: string;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  objective?: string;
  dailyBudgetCents?: number;
  spendCents: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpcCents: number;
  conversions: number;
  roas?: number;
}

// A per-campaign, per-day insight row returned by the connector.
export interface InsightRow {
  campaignId: string;
  campaignName?: string;
  date: string; // YYYY-MM-DD
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpcCents: number;
  roas?: number;
}

// A persisted insight snapshot (D1). Drives charts + anomaly detection.
export interface InsightSnapshot extends InsightRow {
  id: string;
  connectionId: string;
  tenantId: string;
  platform: AdPlatform;
  raw: string | null;
  createdAt: string;
}

export type AlertType = "spend_spike" | "cpc_spike" | "zero_conv";
export type AlertSeverity = "info" | "warning" | "critical";

export interface AdAlert {
  id: string;
  tenantId: string;
  connectionId: string;
  campaignId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metricBefore: number | null;
  metricAfter: number | null;
  date: string;
  firedAt: string;
  acknowledgedAt: string | null;
}

export interface DateRange {
  since: string;
  until: string;
}

// Call context carried to the connector: tenant + signed entitlement token
// (the `ads.service` JWT the host minted via the auth module).
export interface ConnectorContext {
  tenantId: string;
  entitlementToken?: string;
}
