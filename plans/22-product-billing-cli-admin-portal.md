# Product Billing, CLI, And Admin Portal Implementation Plan

Generated: 2026-06-14

This plan is for microservices.sh product billing: users buying and managing access to the microservices.sh managed platform. It is separate from the generated-app `payment-stripe` provider module, which lets a user's generated app accept payments from that user's customers.

Auth prerequisite: implement `21-auth-first-account-and-cli-plan.md` before this billing plan. Billing checkout, Stripe customer mapping, and deploy entitlements need a real `workspaceId`, `ownerUserId`, and scoped CLI/API identity first.

## Current Status
The current product surfaces are close to billing-ready, but billing itself is not implemented:

- The landing page has pricing/beta CTAs, but those CTAs do not create Stripe Checkout sessions.
- The API Worker has health, auth status, MCP, waitlist/events/metrics, and deployment-control routes.
- The API auth gate now has a first D1-backed API-key path with scoped workspace identity, while static bearer tokens remain a temporary `ws_internal` bootstrap fallback.
- The D1 schema now has auth/account and workspace-scoped control-plane tables, but no subscription, invoice, checkout, or entitlement tables.
- The CLI already has `auth`, `deploy`, `logs`, `metrics`, and deploy-pipeline commands.
- A minimal admin portal moodboard exists at `../billing-portal-moodboard.html`.

## Goal
Allow a user to buy a microservices.sh plan, get access to the managed platform, see and manage billing from a minimal admin portal, and use CLI commands for billing status and plan management.

The first production-grade outcome:

1. A user selects a plan from landing page, admin portal, or CLI.
2. The API Worker creates a Stripe Checkout Session.
3. Stripe hosts payment collection.
4. Stripe webhooks update D1 billing state.
5. D1-derived entitlements unlock or block production deploy, provisioning, custom domains, usage, and team actions.
6. The admin portal shows plan, usage, invoices summary, API keys, and a Stripe Customer Portal link.
7. The CLI exposes billing/status/portal commands and returns actionable remediation when a deploy is blocked by plan limits.

## Non-Goals For The First Slice
Do not build these in the first billing release:

- custom card collection UI
- custom invoice PDF or receipt UI
- marketplace/split payments
- raw Cloudflare usage pass-through billing
- complex metered overages
- full enterprise procurement flow
- full team/RBAC beyond owner/admin primitives
- BYO Stripe for microservices.sh product billing
- replacing Stripe Customer Portal with our own cancellation/payment-method screens

## Recommended Stripe Pattern
Use Stripe Checkout Sessions for plan purchase and Stripe Customer Portal for subscription management.

Why:

- Checkout is the hosted payment surface and keeps card collection out of our app.
- Customer Portal lets users update payment methods, cancel, and manage subscriptions without us building billing operations UI too early.
- Webhooks become the source of truth for subscription lifecycle.
- The API Worker is the only place that needs Stripe secret keys.

Avoid Stripe Payment Links for core self-serve billing because plan selection, workspace creation, source attribution, and entitlement mapping should be controlled by our API. Payment Links may still be useful later for manual paid-pilot invoices or a design-partner campaign.

## Architecture
```text
Landing page / Admin portal / CLI
        |
        v
microservices.sh API Worker
  - auth/session
  - checkout session creation
  - customer portal session creation
  - billing status
  - usage status
  - entitlement checks
  - Stripe webhook receiver
        |
        +--> D1 billing/account mirror
        |
        +--> Stripe API

Stripe webhooks
        |
        v
/webhooks/stripe on API Worker
  - verify Stripe-Signature
  - store idempotent event row
  - upsert customer/subscription state
  - derive workspace entitlements
```

Core rule: success redirects are only display state. Fulfillment and entitlements come from verified webhook events plus periodic reconciliation.

## Stripe Object Model
Use Stripe in subscription mode for self-serve plans.

Stripe products and prices:

| Plan | Stripe product | Price mapping | Self-serve |
|------|----------------|---------------|------------|
| Free | none or internal only | none | no checkout |
| Builder | `microservices_builder` | monthly price ID | yes |
| Pro | `microservices_pro` | monthly price ID | yes |
| Agency | `microservices_agency` | monthly price ID or manual invoice | probably manual first |
| Enterprise | custom | quote/invoice | no |

Recommended metadata:

| Object | Metadata |
|--------|----------|
| Customer | `workspaceId`, `ownerUserId`, `ownerEmail` |
| Checkout Session | `workspaceId`, `planId`, `source`, `requestedByUserId` |
| Subscription | `workspaceId`, `planId` |
| Price | stable `lookup_key` such as `microservices_pro_monthly` |

Keep the server-side plan map authoritative. The browser and CLI may request `planId`, but only the API maps that plan to an allowed Stripe price ID.

## D1 Schema Additions
Auth/account tables are owned by `21-auth-first-account-and-cli-plan.md`.

Billing must not recreate or fork `users`, `workspaces`, `workspace_members`, `api_keys`, `auth_login_challenges`, `auth_sessions`, `auth_device_codes`, or `audit_events`. This phase adds billing-only tables and, if needed, explicit ALTER migrations against the canonical auth schema.

```sql
CREATE TABLE billing_customers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE billing_subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  latest_invoice_id TEXT,
  latest_payment_intent_id TEXT,
  past_due_at TEXT,
  grace_ends_at TEXT,
  last_payment_failure_at TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  trial_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE billing_checkout_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  success_url TEXT NOT NULL,
  cancel_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE billing_events (
  stripe_event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  stripe_created INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  processed_at TEXT,
  payload_hash TEXT NOT NULL,
  processing_error TEXT
);

CREATE TABLE workspace_entitlements (
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, key),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE usage_snapshots (
  workspace_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  key TEXT NOT NULL,
  value INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, period_start, period_end, key),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
```

The first implementation can use existing deployment/resource tables to derive usage, then populate `usage_snapshots` later for faster portal reads.

## API Worker Endpoints
Add routes under the existing API Worker. Keep Stripe secret usage server-only.

Public or semi-public:

| Route | Purpose |
|-------|---------|
| `POST /billing/checkout` | Create a Checkout Session for a selected plan. For unauthenticated landing-page starts, create or resume a workspace by email. For authenticated starts, use the current workspace. |
| `GET /billing/success` | Lightweight success screen/state endpoint. Do not grant entitlements from this route. |
| `POST /webhooks/stripe` | Verify and process Stripe webhook events. |

Authenticated:

| Route | Purpose |
|-------|---------|
| `GET /account/me` | Current user, workspace, role, and auth mode. |
| `GET /workspaces` | List accessible workspaces. |
| `POST /workspaces` | Create a workspace before checkout or from admin. |
| `GET /billing/status` | Current plan, subscription status, renewal date, cancellation state, and entitlements. |
| `POST /billing/portal` | Create a Stripe Customer Portal session. |
| `GET /usage` | Current deployment/resource/domain usage against plan limits. |
| `GET /api-keys` | List API key prefixes and metadata. |
| `POST /api-keys` | Create an API key for CLI/MCP use. |
| `DELETE /api-keys/:id` | Revoke an API key. |

Implementation note: the first slice is authenticated-workspace checkout only. Public landing-page checkout remains deferred until the auth-first account claim and email verification flows are proven.

## Webhook Handling
Implement a dedicated Stripe webhook module inside the API Worker.

Required events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Rules:

- Verify `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET` before trusting the event.
- Read the raw request body for signature verification.
- Store `event.id` in `billing_events` for idempotency.
- Process duplicate events as success/no-op only when the existing `billing_events` row is already `processed` with `processed_at` set and no `processing_error`.
- Retry or reconcile duplicate events whose existing row is `pending`, `processing`, or `failed`.
- Upsert customer and subscription state from Stripe objects.
- Derive entitlements after every subscription change.
- Never unlock access from the Checkout success URL alone.
- Add a manual reconciliation command or admin action to refetch Stripe state for a workspace.

## Entitlement Model
Use D1-derived entitlements as the gating layer for CLI, MCP, admin portal, and deployment-control routes.

Initial limits should map to the current pricing hypothesis:

| Plan | Production apps | Preview/dev apps | Custom domains | Team seats | Notes |
|------|-----------------|------------------|----------------|------------|-------|
| Free | 0 | local only | 0 | 1 | docs, module browsing, local generation |
| Builder | 1 | limited | 1 | 1 | first self-serve paid plan |
| Pro | 3 | higher | 3 | 3 | serious builder or small team |
| Agency | 10 | higher | 10 | 10 | likely manual sales first |
| Enterprise | custom | custom | custom | custom | BYO/compliance later |

Gate these actions first:

- `POST /deployments/production`
- `POST /deployments/:id/provision` for production deployments
- `POST /deployments/:id/routes/custom-domain`
- hosted MCP deployment tools that call the same control-plane methods

Remediation payload shape:

```json
{
  "ok": false,
  "error": {
    "code": "PLAN_LIMIT_EXCEEDED",
    "message": "Your workspace needs a paid plan for production deployments.",
    "remediation": "Run microservices billing checkout --plan builder, or open the billing page in the admin portal.",
    "details": {
      "requiredEntitlement": "production_apps",
      "currentPlan": "free",
      "checkoutCommand": "microservices billing checkout --plan builder"
    }
  }
}
```

## CLI Plan
Add billing/account commands to the existing CLI.

Commands:

```text
microservices account status [--json]
microservices workspaces list [--json]
microservices workspaces create --name <name> [--json]
microservices keys list [--json]
microservices keys create --name <name> [--json]
microservices keys revoke <id> [--json]

microservices billing status [--json]
microservices billing checkout --plan builder|pro [--json]
microservices billing portal [--json]
microservices usage [--json]
```

Behavior:

- `billing checkout` calls `POST /billing/checkout` and prints the returned Checkout URL.
- In human mode, offer a copyable URL; only open the browser automatically behind an explicit `--open` flag.
- In `--json` mode, return stable fields: `checkoutUrl`, `sessionId`, `workspaceId`, `planId`.
- `billing portal` calls `POST /billing/portal` and returns the portal URL.
- `deploy production`, `deploy provision`, and `deploy domain` should surface plan-limit remediation without hiding the underlying error code.
- `auth status` should include workspace and billing status once account auth exists.

## Admin Portal Plan
Keep the admin portal minimal and operational, matching the moodboard direction.

First screens:

| Screen | Purpose |
|--------|---------|
| Login | Magic link or temporary invite/API-key bootstrap. |
| Overview | Workspace, plan, deployments, usage, and next action. |
| Billing | Current plan, subscription status, renewal/cancel state, usage limits, Checkout upgrade action, Stripe Portal action. |
| API Keys | Create/revoke CLI keys. Show prefixes only. |
| Projects/Deployments | Existing deployment state with entitlement warnings. |
| Usage | Production apps, preview apps, custom domains, storage/resource usage. |
| Settings | Workspace name, owner email, basic team placeholders. |

Use Stripe-hosted pages for:

- card entry
- payment method updates
- cancellation
- invoice download
- subscription update flows, where Customer Portal configuration supports them

Do not build custom billing operations screens until Stripe Portal is clearly insufficient.

## Auth And Account Bootstrap
The current static bearer-token auth is enough for internal testing, but not for self-serve billing.

Recommended auth model:

| Surface | Auth primitive | Why |
|---------|----------------|-----|
| Admin portal | Opaque, revocable server-side session in a secure HttpOnly cookie | Simple logout/revocation, safer browser storage, works well with D1-backed sessions. |
| CLI | Scoped API keys stored in local CLI config or env var | Stable for agents and CI; can be revoked per workspace and shown as a prefix only. |
| MCP hosted tools | Same scoped API-key model initially | Keeps parity with CLI and avoids a separate auth system. |
| Future browser/API calls | Short-lived JWT only if there is a concrete stateless need | JWTs are harder to revoke and should not be the default long-lived browser credential. |

Do not make long-lived JWTs the primary login model. For the admin portal, prefer an opaque random session token stored as a hash in D1 and sent in a secure cookie. JWTs are acceptable later as short-lived access tokens, but only with a refresh/session store that can revoke compromised sessions.

Recommended sequence:

1. Keep static bearer-token auth for private/internal operations during development.
2. Add user, workspace, login challenge, session, and API-key tables.
3. Add admin portal login with email magic link or OTP.
4. Issue a secure HttpOnly session cookie after login verification.
5. Let authenticated workspace owners start checkout from the portal or CLI.
6. After webhook fulfillment, attach subscription state to that workspace.
7. Let admin create scoped API keys for CLI/MCP.

Avoid putting the Stripe customer ID in CLI config as the main identity. The CLI should authenticate to microservices.sh; the API maps that identity to Stripe.

Login endpoints to add:

| Route | Purpose |
|-------|---------|
| `POST /auth/login/start` | Accept email, rate-limit by IP/email, create a login challenge, and send a magic link or OTP. |
| `POST /auth/login/verify` | Verify challenge, create or update user/workspace, create session, set cookie. |
| `POST /auth/logout` | Revoke current session and clear cookie. |
| `GET /auth/session` | Return current portal session user/workspace. |

Session defaults:

- Session lifetime: 30 days for portal, with explicit logout and revocation.
- Login challenge lifetime: 10-15 minutes.
- Cookie flags: `Secure`, `HttpOnly`, `SameSite=Lax`, path scoped to the admin domain.
- Store only a hash of the session token in D1.
- Rotate session on login and after sensitive account changes.
- Rate-limit login start and verify attempts.

## Secrets And Environment
Add Worker secrets:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SESSION_COOKIE_SECRET
API_KEY_PEPPER
```

Add non-secret vars:

```text
BILLING_ENABLED=true
APP_BASE_URL=https://microservices.sh
ADMIN_BASE_URL=https://admin.microservices.sh
API_BASE_URL=https://api.microservices.sh
STRIPE_PRICE_BUILDER_MONTHLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_AGENCY_MONTHLY=price_...
```

If plan mapping becomes more dynamic, move Stripe price IDs into a D1 `billing_plans` table. For the first slice, env vars are acceptable and easier to reason about.

## File-Level Implementation Map
Expected files and areas:

| Area | Likely changes |
|------|----------------|
| API schema | `api/schema.sql` migration for users, workspaces, keys, billing, entitlements, usage |
| API routes | `api/src/index.ts` route registration for account/billing/webhooks |
| API auth logic | new `api/src/auth.ts` or `api/src/auth/*` for login challenges, sessions, API-key hashing, and request identity |
| API billing logic | new `api/src/billing.ts` or `api/src/billing/*` |
| API auth | replace or extend static bearer token with D1 API-key lookup |
| Control plane | entitlement checks before production/provision/custom-domain side effects |
| CLI | `microservices-sh/packages/cli/src/index.js` billing/account/key/usage commands |
| SDK/MCP parity | expose billing/status tools only if hosted MCP needs billing visibility |
| Admin portal | new portal app or API-served static app, using `billing-portal-moodboard.html` direction |
| Landing page | pricing CTAs call API checkout route or route through account creation |
| Docs | update README, llms docs, and billing operation runbook |

## Implementation Phases
### Phase A: Billing Foundations
Duration: 1-2 days.

- Add billing-only D1 schema for billing customers, subscriptions, checkout sessions, webhook events, entitlements, and usage snapshots.
- Depend on the auth-first user/workspace/API-key/session schema from `21-auth-first-account-and-cli-plan.md`.
- Add server-side plan map.
- Add entitlement derivation helper.
- Add feature flag `BILLING_ENABLED`.
- Add tests for plan mapping and entitlement derivation.

Exit criteria:

- Local D1 migration applies.
- `GET /billing/status` can return a free/internal state for a test workspace.
- Entitlement helper can answer production deploy/custom-domain limits.

### Phase B: Stripe Checkout And Webhooks
Duration: 2-3 days.

- Install or wire Stripe API client for Workers-compatible use.
- Add `POST /billing/checkout`.
- Add `POST /webhooks/stripe` with raw body signature verification.
- Handle required subscription events.
- Store idempotent webhook event rows.
- Upsert local subscription and entitlement state.
- Add Stripe test-mode fixtures or replay tests.

Exit criteria:

- Test-mode Checkout creates a subscription.
- Webhook updates D1.
- Duplicate webhook replay is a no-op.
- Entitlements change only after verified webhook processing.

### Phase C: Admin Portal Billing
Duration: 2-4 days.

- Decide hosting: same API Worker static assets, landing-page app route, or separate admin app.
- Implement login/bootstrap flow.
- Implement secure cookie sessions and logout.
- Implement Overview, Billing, API Keys, Usage, and Projects shell.
- Add Customer Portal session creation.
- Apply the minimal moodboard visual system.

Exit criteria:

- A real user can log in, see current plan/status/usage, create an API key, start checkout, and open Stripe Portal.

### Phase D: CLI Billing And Deploy Gating
Duration: 2-3 days.

- Add `billing status`, `billing checkout`, `billing portal`, and `usage`.
- Add account/workspace/key commands.
- Update deploy commands to surface plan-limit remediation.
- Add entitlement checks to production deploy, provisioning, custom domains, and hosted MCP deploy tools.

Exit criteria:

- CLI can create a checkout URL and read billing status.
- Free workspace is blocked from production deploy with a clear checkout remediation.
- Paid workspace can proceed through existing production/provision/domain flows subject to normal confirmations.

### Phase E: Verification And Runbooks
Duration: 2-3 days.

- Add route tests for checkout, portal, status, webhook, and auth.
- Add Stripe CLI replay or fixture-based webhook tests.
- Add CLI smoke tests in `--json` mode.
- Add admin browser smoke tests for billing and API-key pages.
- Add operational runbook for failed webhooks, failed payment, cancellation, and manual reconciliation.

Exit criteria:

- Billing smoke test passes in Stripe test mode.
- Deploy gating smoke test passes for free and paid states.
- Runbook covers webhook replay and support triage.

## Launch Gates
Use this rollout sequence:

1. Internal test mode only.
2. One manually created paid-design-partner workspace.
3. 3-5 paid beta users with manual monitoring.
4. Public self-serve checkout for Builder and Pro.
5. Agency checkout only after team/workspace support is real, otherwise keep Agency as contact-sales.

Do not turn on public self-serve billing until webhook processing, entitlement checks, admin portal billing status, API-key creation, and CLI remediation are all working in test mode.

## Failure Policy
Plan state handling:

| Stripe/local state | Product behavior |
|--------------------|------------------|
| `active` | Full plan entitlements. |
| `trialing` | Full trial entitlements if trials are enabled. |
| `past_due` | Grace period, then block new production side effects while keeping existing apps running. |
| `unpaid` | Block new production side effects; keep account access for billing recovery. |
| `canceled` | Downgrade to free at period end or immediately depending on Stripe state. |
| webhook delayed | Show pending state; do not unlock from redirect alone. |

Default grace-period recommendation: 7 days for `past_due`, then block new deploy/provision/domain changes but avoid disabling live customer apps automatically in the MVP.

## Security Checklist
- No card data stored in microservices.sh.
- No Stripe secret in CLI, browser, or generated apps for product billing.
- Verify webhook signatures on raw body.
- Store webhook event IDs for idempotency.
- Hash API keys; show only prefix after creation.
- Use secure, HttpOnly, SameSite cookies for admin portal sessions.
- Add CSRF protection for browser mutations.
- Rate-limit public checkout and login starts.
- Keep test and live Stripe keys, webhooks, and D1 environments separate.
- Audit billing admin actions.
- Avoid logging Stripe secrets, session URLs after creation, or full webhook payloads with PII.

## Verification Plan
Automated:

- plan map unit tests
- entitlement derivation unit tests
- API-key hash/lookup tests
- checkout route tests
- portal route tests
- webhook signature/idempotency tests
- deploy-gating tests
- CLI `--json` smoke tests

Manual test-mode:

1. Start checkout from portal.
2. Complete Stripe test payment.
3. Confirm `checkout.session.completed` and subscription events update D1.
4. Run `microservices billing status --json`.
5. Run blocked/free production deploy smoke.
6. Run paid production deploy preparation smoke.
7. Open Customer Portal and cancel.
8. Confirm local state downgrades on webhook.

## Best-Practice Defaults
- Use Checkout and Customer Portal first; build custom billing UI later only for gaps.
- Keep server-side price mapping authoritative.
- Treat webhooks as fulfillment source of truth.
- Treat entitlements as internal derived state, not a direct Stripe API call on every deploy.
- Keep generated-app payments separate from microservices.sh product billing.
- Prefer blocking new side effects over disabling existing customer apps when billing fails.
- Keep human-readable remediation in every CLI billing/entitlement error.
- Keep `--json` responses stable for agents.

## Open Questions
1. Should self-serve checkout require account creation first, or can landing-page email checkout create a pending workspace?
2. Which plans are self-serve at launch: Builder/Pro only, or Agency too?
3. What is the initial auth method for the admin portal: magic link, OTP, or invitation token?
4. Should Stripe Tax be enabled for launch or deferred until the first paid cohort confirms geography?
5. Where should the admin portal live: same API Worker, landing page app, or separate admin app?
6. What exact `past_due` grace period should apply before blocking new production actions?
7. Should successful paid checkout automatically create the first API key, or should users create one explicitly in the portal?

## Recommended First Implementation Slice
Build the smallest self-serve billing loop:

1. Authenticated workspace only.
2. Builder and Pro checkout.
3. Stripe webhooks and D1 subscription mirror.
4. Stripe Customer Portal link.
5. Admin Billing and API Keys screens.
6. CLI `billing status`, `billing checkout`, `billing portal`, and `usage`.
7. Entitlement gates for production deploy and custom domains only.

Leave public landing-page checkout, Agency self-serve checkout, trials, coupons, usage overages, and full team management for the next slice.

## Sources Checked
- Stripe Billing quickstart: https://docs.stripe.com/billing/quickstart
- Stripe Checkout Session API: https://docs.stripe.com/api/checkout/sessions/create
- Stripe Customer Portal Session API: https://docs.stripe.com/api/customer_portal/sessions/create
- Stripe subscription webhooks: https://docs.stripe.com/billing/subscriptions/webhooks
- Stripe webhook signature verification: https://docs.stripe.com/webhooks/signature
- Stripe idempotent requests: https://docs.stripe.com/api/idempotent_requests
