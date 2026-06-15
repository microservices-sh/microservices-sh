# Plan 26 — Identity Layer on Better Auth (user accounts, login, sessions)

**Status:** Draft / proposal — not approved
**Date:** 2026-06-15
**Depends on:** Plan 24 (service topology & auth comms), Plan 25 (connection standard)
**Relates to:** `claudedocs/security-finding-admin-auth.md` (unauthenticated admin PII), auth-contract mismatch (api passwordless email-code vs web-portal password+code)
**Owner:** core

## 1. Problem

Generated apps have **no user-facing identity layer**. `@microservices-sh/auth` is a
token/key authority only — `mintToken · verifyToken · getJwks · rotateSigningKey · scopes`
(EdDSA JWT + JWKS + signing-key rotation). It has **no accounts, sessions, login, password,
email-code, or OAuth**. So templates fake it:

- `booking-sveltekit` / `client-portal-sveltekit` shipped an **unconditional fake admin
  session** in `hooks.server.ts` → `/admin/*` rendered customer PII unauthenticated in prod
  (High-severity finding; booking fixed fail-closed in `5eb40cd`).
- There is no real way for a human to sign in to a generated app's admin or customer portal.

Meanwhile the canonical user-auth story is itself unsettled: **api** is passwordless
email-code; **web-portal** expects password+code; not reconciled. Our own reference app
(`stacksuite/booking-system`) already solved human auth with **Better Auth** (email/password
+ Google, sessions, `isAdmin`), proving it runs on Workers + D1.

**This plan adds the missing identity layer and settles the canonical user-auth story —
without replacing the token substrate.**

## 2. Decisions (proposed)

- **Do NOT replace `@microservices-sh/auth`.** It is the machine/service substrate Plan 24
  (service bindings → JWT scope → HMAC events) and multi-tenant dispatch depend on. Better
  Auth cannot express EdDSA JWKS, scope tokens, or service-to-service auth. Different layer.
- **Add a new module `@microservices-sh/identity`** built on Better Auth (Drizzle adapter on
  D1). It owns: users, credentials (email/password and/or passwordless email-code), OAuth,
  sessions, session cookies, and the login/logout/signup routes.
- **Bridge, don't fork.** On a successful identity session, mint a scoped service JWT via
  `@microservices-sh/auth.mintToken(...)`. Identity → token; the rest of the stack
  (gateway, `/api/*`, dispatch) is unchanged.
- **Settle the canonical user-auth flow** (open question §10) — adopt ONE primary credential
  model across api / web-portal / templates instead of three.

## 3. Layering

```
┌─ @microservices-sh/identity (NEW) ──────────────────────────────┐
│  Better Auth: user · session · account · verification           │
│  routes: /login /logout /signup /api/auth/* (Better Auth handler)│
│  field: user.role / user.isAdmin                                 │
└─────────────┬───────────────────────────────────────────────────┘
              │  on session established →
              │  mintToken({ subject: user.id, scopes: rolesToScopes(user) })
              ▼
┌─ @microservices-sh/auth (UNCHANGED) ────────────────────────────┐
│  mintToken · verifyToken · getJwks · rotateSigningKey · scopes   │
└─────────────┬───────────────────────────────────────────────────┘
              ▼
   gateway / dispatch / /api/* (Plan 24 three-layer auth)
```

Identity sits strictly above the token module. SSR pages authenticate via the Better Auth
session cookie; machine `/api/*` calls continue to use minted scope tokens.

## 4. Template consumption (closes the security finding properly)

`hooks.server.ts` (per template), replacing today's dev-only fake session:

```ts
import { dev } from "$app/environment";
const auth = createIdentity(db, { secret: env.AUTH_SECRET, baseUrl });
const session = await auth.getSession(event.request);          // Better Auth
event.locals.user = session?.user ?? null;                     // null when signed out
// dev convenience (guarded): seed a local admin only when `dev` and no session
if (!event.locals.user && dev) event.locals.user = LOCAL_DEV_ADMIN;
```

Route guards already exist from the security fix and stay as-is:
- `admin/+layout.server.ts` → require `locals.user?.isAdmin` (or role), else 401/redirect.
- `portal/+layout.server.ts` (client-portal) → require a session, else `/login`.

Net: prod `/admin` works for an authenticated admin, fails closed otherwise. No fake session.

## 5. The identity module

| Concern | Approach |
|---|---|
| Library | `better-auth` + `better-auth/adapters/drizzle` (`provider: "sqlite"`), per-request instance (D1 is request-scoped — same pattern as the reference). |
| Schema | Better Auth tables `user · session · account · verification`, plus `user.role` / `user.isAdmin` via `additionalFields`. New Drizzle schema + D1 migration. |
| Credentials | Primary = **decide in §10**. Better Auth supports email/password, and passwordless (email OTP / magic link) via plugin — lets us match the existing email-code contract if that's the canonical choice. |
| Sessions | Better Auth cookie sessions (httpOnly, sameSite). Helper `getSession(request)` for hooks. |
| Token bridge | `rolesToScopes(user) → mintToken(...)`; expose `mintSessionToken(userId)` so `/api/*` calls from the SSR layer carry a scoped JWT. |
| Contract (Plan 25) | Module declares a `connections` manifest: `rpc.calls: ["auth.mintToken"]`, emits `identity.user_registered` / `identity.session_started`, exposes `requires: ["auth"]`. Conforms to the §4 envelope. |
| Multi-tenant | Per-tenant D1 → per-tenant user store (isolation for free). `trustedOrigins` includes the tenant's custom hostname (Plan 24 dispatch). Session cookie scoped to the tenant host. |

## 6. Login → session → token (sequence)

```
user → POST /login (email + credential)
  → identity (Better Auth) verifies → sets session cookie
  → optionally mintToken({subject:user.id, scopes: rolesToScopes(user), ttl})
SSR request → hooks getSession → locals.user
  → admin/+layout.server.ts checks isAdmin → render or 401
SSR → /api/* call → attach minted scope JWT → gateway verifyToken (Plan 24)
```

## 7. Phasing

1. **Spec + decide canonical credential model** (this doc, §10).
2. **Build `@microservices-sh/identity`** — Better Auth config, Drizzle schema + migration,
   `getSession`, `mintSessionToken` bridge, Plan-25 `connections` manifest, ports/adapters
   (D1 + memory for local dev), contract tests.
3. **Wire `booking-sveltekit`** end-to-end: hooks session, `/login`+`/logout`, admin guard
   already present. Boot-verify dev + prod (admin reachable when signed in, 401 otherwise).
4. **Wire `client-portal-sveltekit`** (staff + customer roles) and re-apply/replace the
   fail-closed stub with real sessions. (`saas-starter-sveltekit` already has its own real
   session — reconcile or adopt identity.)
5. **Reconcile api / web-portal** onto the same identity model (retire the email-code vs
   password+code split).

Sequence **after** Plan 25's auth+payment reference migration to avoid contract churn.

## 8. Testing

- **Contract (unit):** session create/verify, role→scope mapping, `mintSessionToken`
  produces a JWT `verifyToken` accepts with the right scopes.
- **Integration (Miniflare + D1):** sign in → session cookie → `/admin` 200; signed out →
  401; non-admin → 403; per-tenant isolation (tenant A session can't read tenant B).
- **E2E (both topologies, per Plan 25 §10):** booking app — anonymous `/admin` → 401;
  sign in → `/admin` 200; SSR→`/api/*` carries a valid scope token.
- **Regression:** the security-finding repro (`/admin/customers/:id` unauthenticated) must
  return 401 in prod build.

## 9. Risks / trade-offs

- **Third-party dep in every generated app.** Dents "verified in-house" — but a maintained
  auth library is more defensible than hand-rolled sessions. Decide the messaging; likely net
  positive (depth > NIH).
- **Workers/D1 compatibility.** Better Auth runs on Workers (reference proves it), but pin a
  known-good version and smoke it under Miniflare + real dispatch.
- **Dependency conflict (found 2026-06-15, spiked in a generated app).** `better-auth@1.6.18`
  peers on **drizzle-orm ^0.45 / drizzle-kit ^0.31 / zod ^4**. Spike findings:
  - The **hard blocker is drizzle, not zod.** A generated booking app ships drizzle-orm 0.41 /
    drizzle-kit 0.30 → `npm i better-auth` fails **ERESOLVE** on the drizzle-kit peer. zod is only
    an overridable *warning* — **zod 3 and zod 4 coexist** in `node_modules` and the app **builds
    fine with both** (verified).
  - **Clean fix (verified):** bump the templates'/modules' drizzle to **`drizzle-orm ^0.45.2 +
    drizzle-kit ^0.31.4`** → `npm i better-auth` installs with **no ERESOLVE, no `--legacy-peer-deps`**,
    and the existing Drizzle code **still builds** (booking template, vite build green on 0.45).
  - So: **do NOT** rely on `--legacy-peer-deps` (it leaves better-auth on drizzle 0.41, an
    unverified runtime mismatch) and **do NOT** migrate zod. Just align drizzle to 0.45/0.31.
  - `@microservices-sh/identity` still does not declare `better-auth`/`drizzle-orm` — the app
    installs them — but the app's drizzle pin must be ≥0.45. Caveat: build ≠ full runtime; smoke
    the booking template's Drizzle queries on 0.45 (low risk — minor bump, typecheck passed).
- **Third auth flavor risk.** Must *settle* the credential model, not add a third. Tie to the
  api/web-portal reconciliation.
- **Plan 25 timing.** Identity declares a `connections` manifest; land it after the contract
  package + auth reference migration stabilize.
- **Existing portal migration.** web-portal already has password+code UI — migration/back-compat
  needed if it adopts identity.

## 10. Open questions (decide before build)

1. **Canonical credential model:** email/password, passwordless email-code, or both (password
   primary + email-code recovery)? This also settles the api/web-portal mismatch.
2. **OAuth providers** in v1? (Google like the reference, or defer.)
3. **Does `saas-starter-sveltekit` adopt identity** or keep its own `readSession`? (One blessed
   pattern is better.)
4. **Token bridge eagerness:** mint a scope JWT at login (store in session) vs mint on demand
   per `/api/*` call.
5. **Module name/scope:** `@microservices-sh/identity` vs folding into `auth` as a submodule.

## 11. Out of scope (YAGNI)

- Replacing `@microservices-sh/auth` internals (explicitly rejected — different layer).
- SSO/SAML/enterprise IdP.
- Org/RBAC beyond `isAdmin`/role — that's `@microservices-sh/org-team-rbac`'s job; identity
  only authenticates, RBAC authorizes.
