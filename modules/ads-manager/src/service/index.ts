import { createOpenclawConnector } from "../adapters/openclaw-connector";
import type { AdsConnector } from "../ports";

export interface AdsServiceEnv {
  // Upstream ads service (openclaw) base URL + M2M service key.
  ADS_SERVICE_URL?: string;
  ADS_SERVICE_KEY?: string;
}

// Host wiring: build the upstream connector from env. Returns null when the
// service isn't configured (the host can then show an "unavailable" state).
export function buildConnector(env: AdsServiceEnv, opts?: { fetchImpl?: typeof fetch }): AdsConnector | null {
  if (!env.ADS_SERVICE_URL || !env.ADS_SERVICE_KEY) return null;
  return createOpenclawConnector({ baseUrl: env.ADS_SERVICE_URL, serviceKey: env.ADS_SERVICE_KEY, fetchImpl: opts?.fetchImpl });
}
