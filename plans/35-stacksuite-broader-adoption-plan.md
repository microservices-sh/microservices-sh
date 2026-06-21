# StackSuite Broader Adoption Plan

## Objective
Identify value in the remaining StackSuite apps beyond the accounting and commerce ports, and decide what should become microservices.sh modules, repo templates, or documentation patterns.

This is an adoption plan, not a copy plan. The useful assets in StackSuite are domain models, workflows, route surfaces, and operational edge cases. They should be ported into the existing module contract standard: typed use cases, memory and D1 adapters, migrations, docs, permissions, events, tests, and reference UI metadata.

## Sources Reviewed
- `~/Project/stacksuite/containers/sms-crm/src/lib/server/db/schema.ts`
- `~/Project/stacksuite/containers/dashdrive/README.md`
- `~/Project/stacksuite/containers/dashdrive/migrations/0001_initial.sql`
- `~/Project/stacksuite/containers/booking-system/src/lib/server/db/schema.ts`
- `~/Project/stacksuite/containers/hr-system/src/lib/server/db/schema.ts`
- `~/Project/stacksuite/containers/helpgrid/migrations/0003_helpgrid_schema.sql`
- `~/Project/stacksuite/containers/helpgrid/migrations/0005_support_tickets.sql`
- `~/Project/stacksuite/containers/accounting-system-chiangs/src/lib/db/schema.ts`
- `~/Project/stacksuite/containers/accounting-system-chiangs/src/lib/api/schemas/invoices.ts`
- repo-local module registry under `modules/*/module.json`
- repo-local templates under `templates/*`

The broad StackSuite inventory also surfaced utility/productivity apps such as JSON editor, QR generator, URL shortener, HTML renderer, Markdown-to-PDF, web builder, CMS/blog/magazine, app screen designer, and video maker. Those are lower-priority unless they reinforce the core System Harness promise.

## Current Coverage
Already covered well enough by current modules/templates:

- Accounting core, AP, AR, bank reconciliation.
- Product catalog, inventory, sales order, shipment, commerce sync.
- Invoice, payment, customer, file media, jobs/workflows, audit, notifications, email, webhook delivery.
- Booking baseline.
- Support ticket baseline, with current route integration in focused templates.
- Knowledge base RAG is present as a draft/concurrent module.

Remaining gaps are mostly add-on business workflows, not more full-app cloning.

## Priority Matrix

| Priority | Candidate | Source Evidence | Recommendation |
|---|---|---|---|
| P0 | `sms-campaigns` module | `sms-crm` contacts, groups, templates, vendor configs, campaigns, recipients, SMS logs | Implemented as a contract-checked module; add an `sms-crm-sveltekit` template only when route proof is needed. |
| P0 | Support inbox/widget hardening | HelpGrid widget settings, quick actions, conversations, messages, channel metadata, agent takeover | Implemented as `support-inbox` to avoid bloating ticket CRUD; ticket comments/attachments/share tokens remain a `support-ticket` follow-up. |
| P1 | Membership and customer credits | Booking membership tiers, customer memberships, credits, credit transactions, membership history | Implemented as `membership-credits`; route proof can extend `booking-sveltekit` later. |
| P1 | Estimates/quotes and recurring invoice templates | Accounting Chiangs estimates, accepted/converted lifecycle, recurring invoices, recurring items, send/post/void schemas | `estimate-quote` and `recurring-documents` implemented; route proof can extend `accounting-erp-sveltekit` later. |
| P1 | Storage entitlements and expiring share links | DashDrive files, short IDs, expiry, download count, storage packages, purchases | `storage-entitlements` implemented; integrate with `file-media` or client portal routes later. |
| P1 | HR people ops | HR employees, departments, positions, leave balances/requests, attendance | `hr-people-ops` implemented; template later, not before focused route proof demand. |
| P2 | Content/CMS publishing | CMS, mini-CMS, blog, magazine | Add only if needed for landing/content-heavy generated apps. |
| P2 | Utility modules | URL shortener, QR generator, document renderer, HTML renderer, video maker | `url-shortener` and `html-renderer` implemented; QR stays reference UI for now; remaining utilities stay small/free-tool candidates until System Harness adoption is proven. |
| P2 | Runtime/control-plane patterns | OpenClaw launcher instance, integrations, channels, custom domains, managed instances | Mine for managed deploy/control-plane design, not as an app template yet. |

## P0 Module Plan: SMS Campaigns

Source value: `sms-crm` has a clean marketing-operations data model that is not covered by current `notifications-inapp` or `email`. It is a good standalone module because SMS has consent, vendor, quota, delivery, and cost semantics.

Proposed module: `modules/sms-campaigns`

Core entities:
- `sms_contacts`: tenant-scoped phone contacts with optional customer link, tags, opt-in state, opt-in source/date.
- `sms_contact_groups`: named groups and contact membership.
- `sms_templates`: reusable body templates with character/segment count.
- `sms_vendor_configs`: provider metadata, enabled/default flags, quota state. Secrets must remain bindings or secret-store references, not raw API keys in D1.
- `sms_campaigns`: draft/scheduled/sending/completed/failed/cancelled lifecycle.
- `sms_campaign_recipients`: per-recipient delivery state.
- `sms_delivery_logs`: provider message id, status, cost, error, timestamps.

Use cases:
- `upsertSmsContact`
- `importSmsContacts`
- `createSmsGroup`
- `createSmsTemplate`
- `configureSmsProvider`
- `createSmsCampaign`
- `scheduleSmsCampaign`
- `dispatchSmsCampaign`
- `recordSmsDelivery`
- `cancelSmsCampaign`
- `getSmsCampaignReport`

Ports:
- `SmsCampaignStore`
- `SmsProvider` with `sendMessage` and optional `getDeliveryStatus`
- `SmsConsentPolicy`

Integrations:
- `jobs-workflows` for scheduled/queued sends.
- `audit-log` for contact imports, campaign sends, provider config changes.
- `customer` for optional customer linkage.
- `webhook-delivery` for outbound campaign events.
- `gateway` for provider webhook authentication.
- `idempotency` for provider callbacks and dispatch retries.

Template after module:
- `sms-crm-sveltekit`: contacts, groups, templates, campaign composer, scheduled sends, delivery report.

## P0/P1 Plan: Support Inbox And Widget Surface

Current `support-ticket` is useful but narrow. HelpGrid shows the missing workflow around embeddable support surfaces and conversation context.

Adoption choice:
- Extend `support-ticket` if ticket comments, attachments, and public ticket links are accepted as core ticket behavior.
- Add `support-inbox` if widget settings, conversations, live chat, and agent takeover should remain separate from ticket CRUD.

Recommended split:
- `support-ticket`: ticket comments, attachments, public share token, sequence numbers, internal notes.
- `support-inbox`: widget settings, quick actions, conversations, messages, channel metadata, agent takeover.
- `knowledge-base-rag`: articles, sources, scans, attachments, search, grounded answers.

Key entities from HelpGrid:
- widget settings and quick actions.
- conversations and messages.
- ticket comments and attachments.
- pending attachments.
- ticket share tokens.
- WhatsApp connections/channel metadata.
- token usage and popular question analytics, later owned by `ai-gateway` or metering.

Template after module:
- `support-center-sveltekit`: project settings, KB, widget preview, inbox, tickets, attachments, analytics.

Do not reintroduce ungated grounded reply generation inside `support-ticket`. Grounded AI belongs behind `knowledge-base-rag` plus `ai-gateway`/approval boundaries.

## P1 Plan: Membership Credits

Booking-system variants have a mature customer-membership and credit ledger shape. Current `booking`, `customer`, `payment`, and `billing-subscriptions` do not model member tier privileges or customer credit balances in a reusable way.

Proposed module: `membership-credits`

Core entities:
- membership tiers with level, badge, price references, benefits, booking privilege constraints.
- customer memberships with active/expired/cancelled/suspended lifecycle, subscription source, renewal/grace state.
- customer credit balances.
- credit transactions with source/reference/actor and before/after balance.
- membership history.

Use cases:
- `createMembershipTier`
- `assignMembership`
- `changeMembershipTier`
- `expireMemberships`
- `grantCustomerCredit`
- `debitCustomerCredit`
- `applyCreditToBooking`
- `refundBookingToCredit`
- `getCustomerMembershipSnapshot`

Integrations:
- `booking` for advance-booking limits, discount eligibility, booking payment with credits.
- `billing-subscriptions` for paid membership subscriptions.
- `payment` for credit package purchases.
- `audit-log` for every balance-changing event.

Template:
- Extend `booking-sveltekit` with a membership/credits variant rather than creating a separate template first.

## P1 Plan: Estimates, Quotes, And Recurring Documents

The accounting Chiangs app has high-value lifecycle behavior not currently represented as a first-class module:

- estimate/quote lifecycle: draft, sent, viewed, accepted, declined, expired, converted.
- quote-to-invoice conversion.
- recurring invoice templates with frequency, end date, next run, max occurrences, auto-send, account defaults.
- send/post/void invoice API schemas.

Recommended modules:
- `estimate-quote`: implemented for quote/estimate documents and conversion handoff to `invoice`.
- `recurring-documents`: implemented for recurring invoices, bills, and scheduled business document draft handoffs.

Use cases:
- `createEstimate`
- `sendEstimate`
- `markEstimateViewed`
- `acceptEstimate`
- `declineEstimate`
- `expireEstimates`
- `convertEstimateToInvoice`
- `createRecurringInvoiceTemplate`
- `runRecurringInvoiceCycle`
- `pauseRecurringInvoice`

Integrations:
- `invoice`, `email`, `file-media`, `accounts-receivable`, `jobs-workflows`, `audit-log`.

Template impact:
- Add quote and recurring invoice routes to `accounting-erp-sveltekit` after the module surface exists.

## P1 Plan: Storage Entitlements And Expiring Shares

DashDrive has a simple but useful storage product surface:

- R2-backed files.
- short public download ids.
- expiry days and expiration cleanup.
- download counts.
- storage packages and one-time purchases.
- storage quota accounting.

Current `file-media` handles upload tickets and owned files. It does not own quota/packages/share-link lifecycle.

Recommended approach:
- Keep bytes/upload metadata in `file-media`.
- Add `storage-entitlements` for quotas, package purchases, and share links.

Use cases:
- `createShareLink`
- `revokeShareLink`
- `resolveShareLink`
- `recordShareDownload`
- `grantStorageEntitlement`
- `getStorageUsage`
- `cleanupExpiredShares`

Integrations:
- `file-media`, `payment`, `jobs-workflows`, `audit-log`.

Template impact:
- Improve `client-portal-sveltekit` file sharing.
- Optional `storage-share-sveltekit` template later.

## P1/P2 Plan: HR People Ops

HR System has a coherent internal-ops model:

- employees.
- departments and positions.
- leave types, leave balances, leave requests.
- attendance records.

Recommended module: `hr-people-ops` (implemented)

Initial scope:
- employee directory.
- department/position hierarchy.
- leave request lifecycle with approval/rejection/cancellation.
- leave balance adjustment using integer hundredths of a day.
- attendance import/listing.

Defer:
- payroll, compliance, benefits, local tax rules, complex scheduling.

Template:
- `hr-ops-sveltekit` only after the module has memory/D1 adapters and route proof.

## P2 Utility Adoption

The utility apps are useful as examples, but they should not distract from business-system modules.

Adopt as small modules only when a concrete template needs them:

- `url-shortener`: implemented for short links, redirect analytics, expiry, deactivation, and recent-link reporting.
- `qr-code`: donor is browser-only generated QR assets, style presets, download formats; keep as reference UI unless durable asset records become necessary.
- `document-renderer`: HTML/Markdown-to-PDF render jobs.
- `html-renderer`: implemented for HTML mockup records, slug validation, TTL expiry, asset metadata, resolve, delete, and listing.
- `content-cms`: pages/posts/media/categories; could back marketing sites and docs.
- `video-generation`: jobs and asset records around provider-backed video creation; likely belongs near `image-generation`.
- `web-builder`: larger and riskier; use as a future template/reference UI, not near-term core.

## Template Strategy

Do not add more templates by cloning full StackSuite apps. Add templates only when the module substrate is already contract-checked.

Recommended order:

1. Harden existing `accounting-erp-sveltekit` and `commerce-ops-sveltekit`.
2. Add `sms-crm-sveltekit` after `sms-campaigns`.
3. Add support-center routes or `support-center-sveltekit` after ticket/inbox/KB split is settled.
4. Add a booking membership variant using `membership-credits`.
5. Add `hr-ops-sveltekit` after HR module proof.
6. Add storage/share or utility templates only if they support acquisition or a paid pilot.

## Implementation Sequence

### Phase A: Close Current StackSuite Port
- Prune inherited broad deps/migrations in focused accounting/commerce templates.
- Keep support route adoption, but document that grounded AI moved out of `support-ticket`.
- Promote draft StackSuite modules only after D1/memory adapters, tests, and focused template routes are stable.

### Phase B: SMS Campaigns
- Completed `modules/sms-campaigns` with standard contract files.
- Completed memory and D1 stores.
- Completed unit tests for campaign lifecycle, opt-out guard, idempotent delivery callback, and scheduled dispatch selection.
- Completed provider port; raw provider credentials stay out of D1 and are represented by secret references.
- Reference UI metadata and operator skill were scaffolded by the standard module layout; deepen them when adding a route proof.
- Add `sms-crm-sveltekit` or routes in a broader CRM template only when the template surface is needed.

### Phase C: Support Inbox Split
- Completed `support-inbox` for widget settings, quick actions, conversations, messages, channel metadata, and agent takeover.
- Kept `knowledge-base-rag` as the grounded-answer provider, not as ticket-internal logic.
- Remaining follow-up: extend `support-ticket` with comments, attachments, public share token, and sequence numbers after the current dirty `support-ticket` edits settle.
- Add route proof in `client-portal-sveltekit` or a focused support template when the module is needed in a demo path.

### Phase D: Membership Credits
- Completed tier/membership/credit ledger module.
- Completed booking credit payment/refund use cases with reference idempotency.
- Remaining follow-up: add route proof in booking template and a formal booking eligibility integration port.

### Phase E: Quotes And Recurring Documents
- Completed `estimate-quote` for quote/estimate documents, lifecycle transitions, and invoice-conversion handoff.
- Completed `recurring-documents` for recurring invoice/bill templates, due-cycle generation, and draft document payload handoff.
- Remaining follow-up: add accounting template routes after the current template route queue settles.

### Phase F: HR And Utility Modules
- Completed `hr-people-ops` for employee directory, org structure, leave balances/requests, and attendance.
- Completed `url-shortener` for tenant-scoped short links, expiry, deactivation, redirect analytics, and recent-link reporting.
- Completed `html-renderer` for HTML render documents, slug/TTL validation, asset metadata, resolve, soft delete, and listing.
- Keep utility modules small and composable.
- Add `hr-ops-sveltekit` only after there is route-proof demand.

## Acceptance Criteria For Every Adopted Module
- `pnpm --filter @microservices-sh/<module> build` passes.
- `pnpm --filter @microservices-sh/<module> test` passes.
- `pnpm --filter @microservices-sh/<module> check:spec` passes.
- Module owns README, README.agent, llms.txt, OpenAPI, schemas, migration, permissions, events, resources, hooks, service, ports, and adapters.
- Memory and D1 adapters exist unless there is a documented durable blocker.
- Route proof exists in at least one template before marketing it as usable.
- Generated create-app bundle closure includes required dependencies.
- All provider writes are idempotent and auditable.
- Tenant checks happen at use-case boundaries, not only in page loaders.

## Decision
The next valuable StackSuite adoption is not another accounting pass. After completing the `sms-campaigns` module, it is:

1. Estimates/quotes and recurring documents as the next accounting add-on.
2. Ticket comments/attachments/share-token hardening once `support-ticket` concurrent edits settle.
3. Route proof for `membership-credits` in booking template when booking membership becomes part of a demo path.
4. HR people ops module proof is complete; add an HR template only after a pilot or demo path needs it.
5. URL shortener and HTML renderer utility proof is complete; keep QR/document/rendering utilities small and add them only when they support acquisition or a template.
6. A focused `sms-crm-sveltekit` or support route/template proof only if those workflows become part of the public demo path.

Everything else should stay P2 until the System Harness launch proof and existing focused templates are cleaner.
