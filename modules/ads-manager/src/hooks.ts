import type { SyncInsightsInput } from "./schemas";
import type { AdAlert } from "./types";

// Customization seam: inspect/adjust a sync request, or return null to skip it.
export async function beforeSync(input: SyncInsightsInput): Promise<SyncInsightsInput | null> {
  return input;
}

// Customization seam: react to a raised alert (e.g. fan out to notifications /
// webhook-delivery). Default is a no-op.
export async function onAlertRaised(_alert: AdAlert): Promise<void> {
  return;
}
