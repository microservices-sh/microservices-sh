// Deterministic ids for idempotent upserts + alert de-duplication. A snapshot is
// unique per (connection, campaign, day); an alert is unique per (connection,
// campaign, type, day) so a daily sweep never double-fires.

export function snapshotId(connectionId: string, campaignId: string, date: string): string {
  return `snap_${connectionId}_${campaignId}_${date}`;
}

export function alertDedupeKey(connectionId: string, campaignId: string, type: string, date: string): string {
  return `${connectionId}:${campaignId}:${type}:${date}`;
}

// Guard: confirm a stored row belongs to the calling tenant before acting on it.
export function belongsToTenant(row: { tenantId: string }, tenantId: string): boolean {
  return row.tenantId === tenantId;
}
