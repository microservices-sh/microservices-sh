# Auth And Billing Plan Review

Generated: 2026-06-14

This review consolidates the local review and three parallel subagent reviews of:

- `21-auth-first-account-and-cli-plan.md`
- `22-product-billing-cli-admin-portal.md`
- `task_plan.md`
- `plans/README.md`
- current API/CLI implementation files

Implementation status as of 2026-06-14: the first API auth/tenancy slice has started. D1 auth tables, workspace-scoped API-key lookup, `ws_internal` static-key compatibility, control-plane workspace scoping, and MCP context propagation have been added. Billing remains blocked until remote migration/backfill, first-owner key bootstrap, CLI profiles, portal sessions, and isolation tests are complete.

## Findings
### Critical: Workspace tenancy is not concrete enough for auth or billing
At review time, current control-plane tables did not have `workspace_id` on `projects`, `deployments`, `deployment_routes`, `deployment_resources`, or `deployment_logs`.

Partial remediation as of 2026-06-14: the first API slice added `workspace_id` to the fresh schema and scoped control-plane queries by workspace. Remaining work: explicit remote D1 migration/backfill and cross-workspace isolation tests.

References:

- `api/schema.sql` currently defines global `projects` at line 38 and global `deployments` at line 59.
- `21-auth-first-account-and-cli-plan.md` line 360 only says to add workspace context.
- `22-product-billing-cli-admin-portal.md` line 315 expects entitlement gates for production/provision/domain actions.

Risk:

- Any future D1 API key could read or mutate another workspace's deployment by ID unless every table and query is scoped.
- Billing usage cannot be safely counted per workspace.
- Entitlement checks can be bypassed by unscoped deployment IDs.

Required fix:

- Add an explicit auth Phase A/B migration step for `workspace_id` on project/deployment control-plane records.
- Define backfill behavior for existing records.
- Update every control-plane read/write query to include workspace scope.
- Add tests that cross-workspace deployment IDs return 404/403.

### Critical: Static bearer-token fallback can bypass future billing gates
The current API accepts static env keys with no user/workspace identity. The auth plan keeps `internal_static_key` temporarily, but does not specify which routes it can satisfy after billing exists.

References:

- `api/src/index.ts` currently builds configured keys from `MICROSERVICES_API_KEY(S)` around lines 58-64.
- `api/src/index.ts` currently authenticates with a raw bearer comparison around lines 74-84.
- `21-auth-first-account-and-cli-plan.md` lines 231-246 keep `internal_static_key`.
- `22-product-billing-cli-admin-portal.md` line 315 expects billing gates on control-plane side effects.

Risk:

- Internal keys could accidentally remain valid for user-facing production deploy/provision/domain actions after billing launches.

Required fix:

- Define `internal_static_key` as maintenance-only.
- Give it a hard retirement milestone.
- Add route/scope rules that prevent static keys from satisfying billing-gated user routes.

### Critical: Stripe webhook idempotency can permanently drop fulfillment
The billing plan says to store `event.id` and process duplicates as success/no-op. That is unsafe if an event row is inserted but processing fails before subscription or entitlement state updates.

References:

- `22-product-billing-cli-admin-portal.md` line 219 defines `billing_events`.
- `22-product-billing-cli-admin-portal.md` lines 293-300 define webhook idempotency behavior.

Risk:

- Stripe retries a failed event.
- The app sees the duplicate event ID.
- The app returns success/no-op.
- Entitlements never update.

Required fix:

- Only no-op duplicates with `processed_at` set and no `processing_error`.
- Pending/error event rows must retry or run reconciliation.
- Store processing attempts and final processing state.

### High: Billing plan duplicates and conflicts with auth schema
The billing plan declares auth as a prerequisite, but still redefines auth tables with narrower shapes.

References:

- `22-product-billing-cli-admin-portal.md` line 7 says auth-first is prerequisite.
- `22-product-billing-cli-admin-portal.md` line 111 reintroduces account/auth schema.
- `21-auth-first-account-and-cli-plan.md` line 66 defines the canonical auth schema.

Risk:

- Agents may implement conflicting migrations.
- Billing may overwrite or fork the auth model.

Required fix:

- Make plan 21 the canonical owner of `users`, `workspaces`, `workspace_members`, `api_keys`, `auth_login_challenges`, `auth_sessions`, `auth_device_codes`, and `audit_events`.
- Plan 22 should add billing-only tables and explicit ALTERs only.

### High: MCP identity is not planned through the tool layer
At review time, hosted MCP was gated once and then tool handlers received only `env`, not request identity.

Partial remediation as of 2026-06-14: hosted MCP payload handling now receives the authenticated request context and passes it into deployment tools. Remaining work: MCP identity tests and future billing entitlement gates.

References:

- `api/src/index.ts` passes only `payload, c.env` to MCP handling around the MCP route.
- `21-auth-first-account-and-cli-plan.md` line 38 says hosted MCP uses scoped API keys.
- `22-product-billing-cli-admin-portal.md` line 320 requires hosted MCP deployment tools to be entitlement-gated.

Risk:

- Without MCP context propagation, MCP tools would remain global even if HTTP routes became workspace-scoped.

Required fix:

- Add `RequestIdentity` to MCP handler signatures.
- Pass workspace ID and scopes into MCP tool calls.
- Add MCP tests for workspace isolation and billing gate failures.

### High: First-owner and first-key bootstrap is underspecified
The plan creates D1-backed API keys before portal sessions are available, but API keys require workspace and creator identity.

References:

- `21-auth-first-account-and-cli-plan.md` line 128 defines `api_keys`.
- `21-auth-first-account-and-cli-plan.md` line 354 starts D1 API-key implementation.
- `21-auth-first-account-and-cli-plan.md` line 453 mentions seeding first owner.

Risk:

- Implementation gets blocked on chicken-and-egg auth setup.
- Temporary routes linger and become production backdoors.

Required fix:

- Define one idempotent bootstrap command or admin-only endpoint.
- Require `BOOTSTRAP_ENABLED=true` and a one-time bootstrap secret.
- Record bootstrap in `audit_events`.
- Disable bootstrap after first owner/workspace/key exists.

### High: CLI workspace switching conflicts with workspace-scoped API keys
The plan says API keys are workspace-scoped but also includes `workspaces switch` and `--workspace`.

References:

- `21-auth-first-account-and-cli-plan.md` line 37 says CLI keys are workspace-scoped.
- `21-auth-first-account-and-cli-plan.md` lines 253-261 add workspace commands.
- `microservices-sh/packages/cli/src/index.js` currently stores one `apiKey` and no workspace ID.

Risk:

- A user may believe a single key can switch workspaces.
- The server may accept a workspace override that violates key scope.

Required fix:

- Use CLI profiles keyed by workspace.
- `workspaces switch` changes active local profile only.
- A workspace-scoped key cannot access another workspace even if `--workspace` is supplied.
- Device login should issue a new scoped key per selected workspace.

### High: Subscription lifecycle mapping is incomplete
The billing plan handles core subscription events but misses normal incomplete/paused/action-required paths.

References:

- `22-product-billing-cli-admin-portal.md` lines 282-289 list webhook events.
- `22-product-billing-cli-admin-portal.md` line 570 starts failure policy.

Risk:

- Unpaid or incomplete subscriptions may accidentally receive paid entitlements.

Required fix:

- Explicitly deny or pending-gate `incomplete`, `incomplete_expired`, `paused`, and failed first invoices.
- Add `invoice.payment_action_required`, `invoice.finalization_failed`, `checkout.session.expired`, and async payment events where relevant.
- Grant entitlements only from an allowlist: `active`, approved `trialing`, and explicitly paid states.

### High: No single-current-subscription invariant per workspace
The plan does not define one active/current subscription per workspace or checkout idempotency.

References:

- `22-product-billing-cli-admin-portal.md` line 189 defines `billing_subscriptions`.
- `22-product-billing-cli-admin-portal.md` line 205 defines `billing_checkout_sessions`.

Risk:

- Repeated CLI/portal clicks can create multiple subscriptions.
- Entitlement derivation becomes ambiguous.

Required fix:

- Add a current subscription invariant per workspace.
- Reuse open checkout sessions where safe.
- Use Stripe idempotency keys for checkout creation.
- Add reconciliation when Stripe has more than one active subscription for a workspace.

### Medium: Admin portal cookies conflict with current CORS shape
The auth plan needs secure cookies, CSRF, and `DELETE /api-keys/:id`, but current CORS allows only `GET`, `POST`, and `OPTIONS` and does not mention credentials.

References:

- `api/src/index.ts` CORS configuration currently only allows `GET`, `POST`, `OPTIONS`.
- `api/wrangler.jsonc` currently sets `ALLOWED_ORIGIN` to `https://microservices.sh`.
- `21-auth-first-account-and-cli-plan.md` lines 329-335 require cookie sessions and CSRF.

Required fix:

- Add admin origin.
- Add credentialed CORS where needed.
- Add `DELETE` support.
- Define CSRF token/header behavior.
- Define cookie domain/path rules.

### Medium: Scope enforcement needs a route matrix
The auth plan has scopes but does not map them to current routes.

Required fix:

Add a route-to-scope matrix for:

- deploy read
- deploy write
- provision
- custom domains
- logs
- metrics
- billing read
- billing write
- API-key management
- workspace admin

Also decide whether API keys may create other API keys. Default should be no.

### Medium: Public checkout conflicts with auth-first rollout
The billing plan allows unauthenticated landing-page checkout, but the recommended first slice says authenticated workspace only.

References:

- `22-product-billing-cli-admin-portal.md` line 259 allows unauthenticated checkout.
- `22-product-billing-cli-admin-portal.md` line 636 recommends authenticated workspace only.

Required fix:

- First slice should be authenticated workspace checkout only.
- Public landing-page checkout should stay deferred until account claim and email verification flows are proven.

### Medium: Billing failure/grace state lacks required fields
The plan recommends a past-due grace period, but the schema does not store dunning timestamps or latest invoice/payment state.

Required fix:

- Add fields such as `past_due_at`, `grace_ends_at`, `latest_invoice_id`, `latest_payment_intent_id`, and `last_payment_failure_at`.
- Derive entitlement state from those fields plus subscription status.

### Medium: Agency self-serve appears in commands despite being deferred
The plan says Agency is likely manual, and the recommended slice excludes Agency, but CLI/env examples include Agency checkout.

Required fix:

- First self-serve billing should expose only Builder and Pro.
- Keep Agency as contact-sales/manual until team/workspace support is real.

### Medium: Test infrastructure is not ready for auth/billing risk
The plans list the right kinds of tests, but the current API/CLI packages appear to have typecheck/syntax checks rather than route and migration test harnesses.

Required fix:

- Add Worker route test harness.
- Add local D1 migration fixtures.
- Add CLI `--json` smoke tests.
- Add cross-workspace isolation tests.
- Add Stripe webhook fixture/replay tests before live billing.

### Medium: Planning state and sequencing are stale
The docs now contain good auth/billing direction, but sequencing is inconsistent.

Examples:

- `task_plan.md` says current phase is Phase 22, but Phase 22 is a completed planning phase.
- `plans/README.md` immediate next actions still begin with older funnel/create-app tasks instead of auth implementation.
- Auth plan file is numbered `21`, but task/progress call it Phase 22.
- `plans/README.md` places template docs before auth/billing in reading order, even though auth now gates billing.

Required fix:

- Add a new current phase for auth implementation.
- Split README next actions into "historical backlog" and "current implementation sequence", or replace with the current sequence.
- Normalize phase/file numbering before more agents implement from these docs.

### Low: Path names drift across historical docs
Older progress entries mention `apps/api` and `apps/cli`, while the current workspace uses `api` and `microservices-sh/packages/cli`.

Required fix:

- Add a short "current repo paths" note near the new auth/billing plans.
- Avoid editing historical progress unless needed.

## Recommended Remediation Order
1. **Docs cleanup before coding**
   - Make plan 21 the canonical auth/account schema.
   - Remove auth table definitions from plan 22 or replace them with "provided by plan 21."
   - Make the first billing slice authenticated Builder/Pro checkout only.
   - Add a route-to-scope matrix.
   - Add current implementation phase to `task_plan.md`.

2. **Auth implementation Phase A**
   - Add auth schema plus `workspace_id` migration for current control-plane tables.
   - Add bootstrap path for first owner/workspace/key.
   - Add `RequestIdentity` middleware.
   - Keep static key fallback maintenance-only.

3. **Auth implementation Phase B**
   - Add D1-backed API key lookup.
   - Add workspace-scoped project/deployment queries.
   - Add CLI profile/workspace behavior.
   - Pass identity through MCP.

4. **Admin portal auth**
   - Add session login/logout.
   - Add API-key management.
   - Add CORS/cookie/CSRF behavior.

5. **Billing implementation**
   - Add Stripe Customer create/reuse before Checkout.
   - Add single-current-subscription invariant.
   - Add safe webhook idempotency state machine.
   - Add lifecycle allowlist for entitlements.
   - Add grace-period fields and reconciliation.

6. **Verification**
   - Add route tests, D1 fixtures, CLI smoke tests, MCP identity tests, and Stripe webhook replay tests.

## Go/No-Go
Do not start billing implementation yet.

Start auth implementation only after the plan is tightened on:

- workspace tenancy DDL and backfill
- static key cutoff
- first-owner bootstrap
- CLI profile/workspace semantics
- MCP identity propagation
- route-to-scope matrix
- test harness

The auth-first direction is correct. The current plans need the above tightening before multiple agents safely implement from them.
