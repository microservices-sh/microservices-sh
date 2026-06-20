// Provisioning bridge for the ops read-back (Plan 32, P1, step 2).
//
// Runs where the per-tenant grant secret is available (the control-plane
// provisioning step / CLI — NOT the API response path, which redacts the secret).
// It mints the OPS_TOKEN from the grant and emits the two operator commands that
// deliver the credentials to the two platforms:
//   • OPS_TOKEN          → the Hermes machine (Fly)
//   • OPS_VERIFY_SECRET  → the client's operate app (Cloudflare Worker)
// Different platforms, so the commands differ (fly vs wrangler). Until Fly/CF
// secret automation exists, an operator runs them; the same plan is what an
// automated adapter would feed to the Fly Machines + CF secrets APIs.

import { mintOpsToken } from "./index.js";

export async function planOpsProvisioning(input, deps = {}) {
  const { grant, hermesApp, operateApp } = input;
  const mint = deps.mint ?? mintOpsToken;

  const opsToken = await mint(
    { ownerId: grant.ownerId, scopes: grant.scopes, exp: grant.expiresAt },
    { secret: grant.secret }
  );

  return {
    opsToken,
    expiresAt: grant.expiresAt,
    hermesSecretCommand: `fly secrets set OPS_TOKEN=${opsToken} -a ${hermesApp}`,
    operateSecretCommand: `printf %s '${grant.secret}' | wrangler secret put OPS_VERIFY_SECRET --name ${operateApp}`
  };
}
