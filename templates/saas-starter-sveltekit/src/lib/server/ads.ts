import {
  createD1AdsStore,
  createMemoryAdsStore,
  createMemoryConnector,
  buildConnector,
  type AdsStore,
  type AdsConnector,
  type Entitlement,
} from "@microservices-sh/ads-manager";
import { listSubscriptions, grantsAccess } from "@microservices-sh/billing-subscriptions";
import type { BillingStore } from "@microservices-sh/billing-subscriptions/ports";
import { mintToken, getJwks, rotateSigningKey } from "@microservices-sh/auth";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";

// Ensure the app has a signing key (the demo session flow never mints one, so the
// store can be empty). Used by both the JWKS endpoint and entitlement minting.
export async function ensureSigningKey(store: SigningKeyStore): Promise<void> {
  const jwks = await getJwks({ signingKeyStore: store });
  const keys = jwks.ok ? (jwks.data as { keys?: unknown[] }).keys : undefined;
  if (!keys || keys.length === 0) await rotateSigningKey({ signingKeyStore: store });
}

// Mint the short-lived `ads.service` entitlement JWT the upstream ads service
// verifies (model B). `issuer` identifies THIS app so the upstream can resolve
// our JWKS by the token's `iss` (multi-app: many consuming apps each mint their
// own tokens). It must equal the issuer registered with the upstream, whose JWKS
// URL points at this app's /api/auth/jwks. Best-effort: never blocks the page.
export async function mintAdsToken(
  store: SigningKeyStore,
  subject: string,
  orgId: string,
  issuer?: string,
): Promise<string | undefined> {
  try {
    await ensureSigningKey(store);
    const input = { subject, workspace: orgId, project: "ads", scopes: ["ads.service"], ...(issuer ? { issuer } : {}) };
    const r = await mintToken(input, { signingKeyStore: store });
    return r.ok ? (r.data as { token: string }).token : undefined;
  } catch {
    return undefined;
  }
}

// This app's entitlement issuer — a stable identity the upstream ads service has
// registered (→ our JWKS at `${issuer}/api/auth/jwks`). Prefer an explicit env
// override; fall back to the request origin so dev works without config.
export function adsIssuer(platform: App.Platform | undefined, origin: string): string {
  const env = (platform?.env ?? {}) as { APP_PUBLIC_URL?: string };
  return env.APP_PUBLIC_URL ?? origin;
}

// Dev singleton: persists ad data across requests when no D1 binding is present.
const memoryAdsStore = createMemoryAdsStore();

// Ads-service env rides alongside the D1 binding. Cast locally (no app.d.ts surgery).
type AdsEnv = NonNullable<App.Platform["env"]> & { ADS_SERVICE_URL?: string; ADS_SERVICE_KEY?: string };

// Entitlement = an active subscription on the billing module (the $1.90/mo ads
// plan; here any active org subscription stands in). Returns the 402 reason when
// inactive so the route can show the subscribe state.
export function billingEntitlement(billingStore: BillingStore): Entitlement {
  return {
    async check(tenantId: string) {
      const subs = await listSubscriptions({ subscriberId: tenantId, limit: 1 }, { store: billingStore });
      const sub = subs.ok ? subs.data.subscriptions[0] ?? null : null;
      return sub && grantsAccess(sub.status)
        ? { active: true }
        : { active: false, reason: "Subscribe to Ads ($1.90/mo) to monitor your campaigns." };
    },
  };
}

export function resolveAdsDeps(platform: App.Platform | undefined): { store: AdsStore; connector: AdsConnector } {
  const env = (platform?.env ?? {}) as AdsEnv;
  const store: AdsStore = env.DB ? createD1AdsStore(env.DB) : memoryAdsStore;
  // Real upstream connector when configured; otherwise a deterministic demo connector
  // so the dashboard is explorable without the openclaw ads service.
  const connector: AdsConnector = buildConnector(env) ?? createMemoryConnector();
  return { store, connector };
}
