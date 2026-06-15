# @microservices-sh/identity

Passwordless **email-code** identity + server-side **sessions**, built on
**`@microservices-sh/auth`** — no third-party auth dependency, no zod migration. The human
logs in with an emailed code; a server-side session is opened; SSR → `/api/*` hops carry a
short-lived scoped JWT minted via the auth module. See
[`plans/26-identity-better-auth.md`](../../plans/26-identity-better-auth.md).

> **Why not Better Auth?** A runtime spike (Plan 26 §9) showed Better Auth requires migrating
> the whole module layer from zod 3 → 4 (breaking, mid-Plan-25). This module dogfoods the
> product's own verified auth primitive instead — on-positioning and migration-free.

## Status
| Part | State |
|---|---|
| Login codes (`requestLoginCode` / `verifyLoginCode`) | ✅ Implemented + tested — hashed storage, 10-min expiry, single-use, 5-attempt cap, constant-time check |
| Sessions (`readSession` / `destroySession` + cookie helpers) | ✅ Implemented + tested — opaque 256-bit id, 30-day rolling, fail-closed |
| Token bridge (`mintSessionToken`) | ✅ Proven — admin → `gateway.admin` JWT, non-admin none, cross-tenant rejected |
| In-memory adapters | ✅ For tests/dev |
| **D1 adapters + migration** | ✅ Implemented (`src/adapters/d1.ts`, `migrations/0001_identity.sql`) — typecheck-clean vs `D1Database`, mirror the memory semantics. Runtime-on-D1 validated at template-wiring boot (codebase convention — `auth` validates its D1 adapter the same way). |
| **Template wiring** (booking `/login`, hooks, guard) | 📝 To do — see the guide below |

Validate: `npx vitest run modules/identity/tests/` (**15/15**) · `npm run build` (typecheck, clean)

## Flow
```
POST /login {email}        → requestLoginCode → email module sends the 6-digit code
POST /login {email, code}  → verifyLoginCode  → opens a session → Set-Cookie msh_session=<id>
SSR request                → parseSessionCookie → readSession → locals.user (or null)
/admin/+layout.server.ts   → require locals.user.isAdmin (fail closed)   [already in template]
SSR → /api/*               → mintSessionToken(user) → Bearer <scoped JWT>  [Plan 24 gateway]
```

## Surface
- `requestLoginCode({ email }, { accountStore, loginCodeStore, adminEmails?, now? })` → `{ email, code }` (caller emails `code`)
- `verifyLoginCode({ email, code }, { accountStore, loginCodeStore, sessionStore, now? })` → `{ sessionId, user }`
- `readSession({ sessionId }, { sessionStore, accountStore, now? })` → `{ user | null }` (rolling refresh)
- `destroySession({ sessionId }, { sessionStore })`
- `serializeSessionCookie / clearSessionCookie / parseSessionCookie` · `SESSION_COOKIE`
- `mintSessionToken(user, { signingKeyStore, workspace, project })` → scoped EdDSA JWT
- ports `AccountStore · LoginCodeStore · SessionStore` + `createMemory*Store`

All use-cases return the connection-contract Result envelope (`{ ok, status, data | error, meta }`).

## Template wiring (booking) — apply when D1 adapters land
1. **D1 adapters** for the three stores + a migration (`accounts`, `login_codes`, `sessions`).
2. **`/login`** route: `POST` email → `requestLoginCode` → send via `@microservices-sh/email`;
   `POST` email+code → `verifyLoginCode` → `Set-Cookie` from `serializeSessionCookie`.
3. **`hooks.server.ts`**: `parseSessionCookie(cookie)` → `readSession` → `locals.user`
   (replaces the dev-only stub; the `dev` admin fallback can stay for local convenience).
4. **`/admin/+layout.server.ts`** guard already enforces `locals.user.isAdmin` (fail closed).
5. **SSR → `/api/*`**: `mintSessionToken(locals.user, …)` → `Authorization: Bearer`.

## Config / notes
- `adminEmails` provisions bootstrap admins on first login; replace with an invite/role flow later.
- Email deliverability becomes auth-critical (the code must arrive) — monitor it.
- Session ttl (30d rolling) and code ttl (10m) are in `src/config.ts`.
