# Security Finding — Unauthenticated admin PII exposure in `booking-sveltekit`

**Severity:** High (confidentiality — customer PII exposed without authentication)
**Status:** Confirmed, reproduced on a fresh app from the published `create-microservices-app@0.2.3`
**Date:** 2026-06-15
**Affected:** `templates/booking-sveltekit` (and the generated apps it produces). Other SvelteKit templates that copy the same `hooks.server.ts` pattern should be audited.

## Summary
The `/admin/*` SSR pages render real customer PII (names, emails, phone numbers) and are **served without any authentication check — in production, not only local dev.** The auth system (`verifyToken` + `gateway.admin` scope) only guards the machine-facing `/api/*` routes; the human-facing admin UI is unprotected.

This is the exact "agents get auth wrong structurally" failure mode the product positions against, shipping in the flagship template.

## Root cause (two compounding defects)
1. **Unconditional fake admin session.** `src/hooks.server.ts`, the `else` branch for non-`/api/` requests:
   ```ts
   } else {
     // Session path for SSR pages (local dev admin).
     event.locals.user = { id: "local-admin", email: "admin@example.com", isAdmin: true };
   }
   ```
   The comment says "local dev" but there is **no `dev`/env guard** — it executes in every environment. Every SSR request is handed an admin session.
2. **Admin pages never check authorization.** `src/routes/admin/+page.server.ts`, `admin/bookings/+page.server.ts`, `admin/customers/[id]/+page.server.ts` load and return data straight from `locals.*Repository`. There is **no `+layout.server.ts`** at `src/routes/admin/` and **no read of `locals.user`/`isAdmin`** anywhere in the admin tree. No redirect, no 401.

Even if defect 1 were fixed alone, the pages would still not enforce; even if the pages checked `isAdmin`, defect 1 sets it `true`. Both must be fixed.

## Reproduction
```bash
npm create microservices-app@latest app -- --template booking-sveltekit
cd app && npm install && npm run microservices -- local setup
npm run microservices -- local dev --port 5174 &
# Unauthenticated, no token, no cookie:
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5174/admin/bookings        # -> 200
curl -s http://127.0.0.1:5174/admin/customers/<id>                                    # -> 200 + full PII
```
Contrast — the machine API gate works correctly:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5174/api/gateway/keys       # -> 401 (no token)
curl -s -o /dev/null -w "%{http_code}\n" -H 'authorization: Bearer bad' .../api/gateway/keys  # -> 401
```

## Impact
Any deployed booking app exposes its full customer list and per-customer detail (name/email/phone) to anyone who can reach `/admin/*`. No credentials, no enumeration barrier (`/admin/customers/:id` honors arbitrary ids). Direct breach of the product's core promise ("verified auth your agent can't get wrong").

## Recommended fix (see companion patch)
1. **Dev-guard the fallback.** Only inject `local-admin` when `import('$app/environment').dev` is true. In prod, non-`/api/` requests get **no** authenticated user.
2. **Add `src/routes/admin/+layout.server.ts`** that requires `locals.user?.isAdmin`, else `throw error(401)` (fail-closed) or redirect to an admin login.
3. **Prod admin session (follow-on):** wire a real admin session (cookie minted from a `gateway.admin`-scoped token via the existing bootstrap/token flow) so `/admin` is reachable in prod by an authenticated admin. Until then, fail-closed (401) is correct — no PII leak.

Fail-closed (steps 1–2) closes the vulnerability immediately; step 3 restores prod admin access as a feature.

## Cross-template audit (2026-06-15)
All SvelteKit templates audited for the same class of flaw (unauthenticated PII pages):

| Template | Verdict | Action |
|---|---|---|
| `booking-sveltekit` | ❌ Vulnerable — unconditional fake admin, no page guard | **Fixed + boot-verified** (dev 200 / prod 401, no PII) — commit `5eb40cd` |
| `client-portal-sveltekit` | ❌ Vulnerable, **worse** — `?role=staff` self-elevation + fake role-picker login, no `/admin` or `/portal` guard, no dev guard | **Fixed + prod-boot-validated** (2026-06-15). Dev-guarded the demo session + login; added fail-closed `/admin` (staff-only, 403) and `/portal` (auth, /login) layout guards. Validated by temporarily wiring the template into create-app and booting a production build: anon `/admin`, `/admin/customers`, `/admin/invoices`, `/portal`, `/portal/invoices` all → **303 → /login** (no PII); `?role=staff` self-elevation → **303** (blocked in prod). The create-app wiring was reverted afterward — see next row. |
| client-portal **template completeness** (separate finding) | ⚠️ The template ships with **no `migrations/` directory**, so its module tables (customer, invoice, …) are never created → dev boot 500s (`D1_ERROR: no such table: customers`). Surfaced when booting it for validation. Independent of the auth fix (prod fails closed before any DB access). **Not shippable via create-app until it has migrations** — which is why it stays out of `REPO_TEMPLATES`. Likely moot once it adopts the identity module (Plan 26). |
| `saas-starter-sveltekit` | ✅ Not vulnerable — real cookie `readSession`, `/admin` `+layout.server.ts` enforces `isSuperAdmin` (403) + `/login` redirect, `/app` membership gate | None — this is the reference pattern |

## Note for maintainers
If the intended deployment model is "admin behind Cloudflare Access / Zero Trust," that must be (a) documented in the template README/`docs/`, and (b) the unconditional `isAdmin: true` fallback still removed, since it would override any external gate's identity assumptions inside the app.
