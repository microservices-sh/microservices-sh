# booking-sveltekit — revamp plan

*Created 2026-06-15. Goal: raise this template to a production-credible single-vertical appointment-booking scaffold, informed by a teardown of `stacksuite/containers/booking-system`, without turning it into that monolith.*

## Decisions (locked)
- **Scope:** focused production-credible single vertical. Keep the composable module-scaffold identity. Heavy SaaS surfaces (memberships, coupons, credits, multi-vertical, CMS, full i18n, staff/resources) stay out — optional future modules only.
- **Data layer:** adopt **Drizzle ORM**, boundary **A** — Drizzle owns the template's data layer + all new booking-domain tables; the shared module packages (booking/customer/auth/audit/gateway) keep their ports and continue hitting the same physical D1 tables. Full conversion of the shared module internals to Drizzle is a separate later decision (high blast radius: 3 templates).
- **Branch:** stay on the current working branch for now.

## What we adopt vs leave (from stacksuite)
**Adopt (mapped to existing module slots):** real availability engine (weekly rules + exceptions + buffers + timezone-correct slots); reschedule/cancel + cancellation-policy window; booking holds; activate `payment` (Stripe deposit/checkout + webhook + refund) and `email` (confirmation + cron reminder) slots; admin calendar UI + search/filter + icons + motion/a11y polish.
**Leave (stacksuite product surface):** memberships/tiers, coupons, credits, multi-vertical unified booking, CMS pages/navigation, 1787-string i18n, providers/resources staff scheduling. Borrow cheap *patterns* only (audit denormalization, hold-expiry, translated-field type).

## Phases
- **P0 — Foundations:** add Drizzle (`drizzle-kit`, `schema.ts`, `drizzle.config.ts`); Drizzle schema covering existing tables + new `company_settings` (timezone, currency, cancellation policy, reminder hours, deposit %); baseline migration; D1 wired. Modules unchanged (boundary A).
- **P1 — Availability + timezones:** `availability_rules` (weekly, per-service, buffers, price override) + `availability_exceptions` (holidays/special hours). Engine: slots = rules − bookings − exceptions − buffers, generated in company TZ with DST-correct math. `/book` uses it.
- **P2 — Lifecycle:** reschedule / cancel use cases + API + customer & admin UI; notice-window policy; `hold_expires_at` slot holds; cron expires stale holds.
- **P3 — Activate slots:** `payment` (Stripe checkout/deposit, webhook, refund-on-cancel); `email` (confirmation + reminder via Cloudflare `scheduled` cron, pluggable provider, templated).
- **P4 — Admin calendar + polish:** day/week calendar replacing flat lists; search/filter; lucide icons; motion/SVG pass; accessibility.

## Definition of done (per phase)
build → `microservices check` → e2e (generate via create-app → build → screenshot) → commit. Update `microservices.template.json`, `README*`, `THEMING.md`, and the public registry as capabilities land.

## Status
- [x] P0 Foundations — drizzle-orm + drizzle-kit added; `src/lib/server/db/schema.ts` mirrors all tables + new `company_settings`; `db/index.ts` client; `settings.ts` loader (graceful no-DB fallback); `migrations/0005_company_settings.sql`; root `+layout.server.ts` loads settings via Drizzle, brand wired. Build + `microservices check` pass. (Live-D1 read deferred to P1.)
- [x] P1 Availability + timezones — `availability_rules` + `availability_exceptions` tables (Drizzle + `migrations/0006_availability.sql`, seeded Mon–Fri 09–17); pure `src/lib/server/availability.ts` engine (rules − exceptions − bookings − buffers, DST-correct via date-fns-tz, closed + special-hours overrides); `/book` + `/api/availability` rewired to it; slot labels formatted in company timezone. Verified: build, engine runtime tests (TZ/conflict/closed/special), migrations applied to real SQLite, `microservices check`.
- [x] P2 Lifecycle — cancel (reuses module `cancelBooking`) with policy gate (`lifecycle.ts canCancel`: admin bypass, allow flag + notice-window) on customer confirmation page + admin detail; admin reschedule (book new slot via engine, then cancel old, phone preserved); `holds` table (Drizzle + `migrations/0007`) merged into the availability engine as blocking; `/api/holds/expire` (CRON_TOKEN-gated) + `expireHolds`. Full scheduled() worker deferred to P3 (shared with reminders). Verified: build, `microservices check`, holds migration on SQLite, canCancel runtime tests.
- [ ] P3 Payment + email
- [ ] P4 Admin calendar + polish
