# @microservices-sh/identity (Plan 26 prototype — draft)

User identity (accounts, login, sessions) on **Better Auth**, bridging to
**`@microservices-sh/auth`** for service tokens. This is the missing human-facing auth
layer; it does **not** replace the token/JWKS/scope substrate. See
[`plans/26-identity-better-auth.md`](../../plans/26-identity-better-auth.md).

## Status
| Part | State |
|---|---|
| **Token bridge** (`rolesToScopes` → `mintSessionToken` → `verifyToken`) | ✅ **Proven** — `tests/bridge.test.ts`, 4/4 against the real `@microservices-sh/auth` (admin→`gateway.admin`, non-admin fails closed, cross-tenant token rejected) |
| Better Auth config / session / schema | 📝 Code-complete, **not yet installed/booted** — needs `pnpm install` (adds `better-auth`, `drizzle-orm`) + the D1 migration |
| Canonical credential model (email/password vs passwordless email-code) | ⛔ **Blocked on Plan 26 §10.1 decision** — prototype defaults to email/password |
| Template wiring (booking) | 📝 Ready-to-apply below — intentionally NOT applied to the live template (importing an uninstalled module would break the published build) |

Run the proven part: `npx vitest run modules/identity/tests/bridge.test.ts`

## Surface
- `createIdentity(db, { secret, baseUrl, trustedOrigins })` → per-request Better Auth instance
- `getSession(auth, request)` → `{ user: IdentityUser, sessionId } | null`
- `rolesToScopes(user)` → service scopes (`gateway.admin` for admins)
- `mintSessionToken(user, { signingKeyStore, workspace, project })` → scoped EdDSA JWT via `@microservices-sh/auth`
- `schema` — Better Auth drizzle tables (`user/session/account/verification` + `isAdmin`)

## Wiring guide — booking-sveltekit (apply after install)

> Prereq: `pnpm add @microservices-sh/identity better-auth drizzle-orm` in the app,
> set `AUTH_SECRET`, and generate the D1 migration from `schema` (`@better-auth/cli generate`).

**1. `src/hooks.server.ts`** — replace the dev-only fake session with a real one
(keeps the `dev` fallback already added in commit `5eb40cd`):
```ts
import { dev } from "$app/environment";
import { createIdentity, getSession } from "@microservices-sh/identity";

// inside handle(), for non-/api/ SSR requests:
const auth = createIdentity(db, {
  secret: env.AUTH_SECRET,
  baseUrl: event.url.origin,
  trustedOrigins: [event.url.origin]
});
const session = await getSession(auth, event.request);
event.locals.user = session?.user
  ?? (dev ? { id: "local-admin", email: "admin@example.com", isAdmin: true } : null);
```

**2. `src/routes/api/auth/[...all]/+server.ts`** (new) — Better Auth handler:
```ts
import { createIdentity } from "@microservices-sh/identity";
import type { RequestHandler } from "./$types";
const handler: RequestHandler = ({ request, platform }) => {
  const auth = createIdentity(platform!.env.DB, {
    secret: platform!.env.AUTH_SECRET,
    baseUrl: new URL(request.url).origin
  });
  return auth.handler(request);
};
export const GET = handler;
export const POST = handler;
```

**3. `src/routes/login/+page.server.ts`** (new) — sign in via Better Auth, then redirect.
**4. `src/routes/logout/+page.server.ts`** (new) — `auth.api.signOut(...)` + redirect.

**5. The guard is already in place** — `src/routes/admin/+layout.server.ts` (commit `5eb40cd`)
requires `locals.user.isAdmin` and fails closed. No change needed; it now enforces against a
real session instead of the dev stub.

**6. SSR → `/api/*`** — when an admin page calls a protected API, mint the gateway token:
```ts
const { data } = await mintSessionToken(locals.user, {
  signingKeyStore: locals.signingKeyStore, workspace, project
});
// fetch('/api/...', { headers: { authorization: `Bearer ${data.token}` } })
```

## Next (gated)
1. Decide Plan 26 §10.1 (credential model) — flips `emailAndPassword` vs the email-OTP plugin.
2. `pnpm install` + D1 migration, then apply the wiring above and boot-verify booking
   (anon `/admin` → 401; sign in → 200; SSR→`/api/*` carries a valid scope token).
