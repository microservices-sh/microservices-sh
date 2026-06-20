# Proof: a cross-tenant read fails our build

> The single most-cited failure of AI-built apps is the cross-tenant data leak —
> one customer reads another's data because the tenant scope was trusted from the
> request instead of the session. It is the class behind **CVE-2025-48757**, an
> RLS/scoping miss that exposed data across **170+ Lovable apps**.
>
> This directory proves, with executable code against the **real shipped module**,
> that microservices.sh makes that leak fail the build.

## What it proves

[`cross-tenant-leak.proof.test.ts`](./cross-tenant-leak.proof.test.ts) runs three
assertions against `@microservices-sh/invoice` — the actual code a generated app
ships, not a mock. Two paying orgs (`tenant-a`, `tenant-b`) share one deployment
and one D1 database (the multi-tenant reality):

1. **The leak is real.** A route that trusts a request-supplied `tenantId` — what
   an AI agent writes by default — lets `tenant-a`'s session read `tenant-b`'s
   invoices. The database does not stop it: D1/SQLite has no row-level security.
2. **The boundary closes it.** The enforced wrapper `listInvoicesScoped(ctx, …)`
   takes the tenant from a server-resolved `AuthContext`, never from the request.
   The same forged `tenant-b` id is inert — only the caller's rows come back.
3. **Enforcement is structural.** A scoped call with no session scope is refused
   (403), never silently run unscoped — and a valid `AuthContext` cannot even be
   constructed without a non-empty org.

## Run it

```bash
# from the repo root
npx vitest run --config proofs/no-cross-tenant-leak/vitest.config.ts
```

Expected: `3 passed`. STEP 1 passing is the uncomfortable part — it confirms the
leak is real in naive code. STEP 2 and 3 are the product.

## How a real regression goes red

The proof above shows the *mechanism*. Two CI layers make it continuous:

- **Per-module leak tests** (L4) — every tenant-scoped module ships a
  `*.scope.test.ts` that seeds two tenants, acts as one, and asserts **zero**
  cross-tenant rows. These run in the main `pnpm test` suite.
- **The route guard** (L5) — `pnpm spec:check:all` fails the build if any template
  route imports a raw, input-trusting tenant use-case instead of the enforced
  `*Scoped` wrapper. Watch it fire:

  ```bash
  ./proofs/no-cross-tenant-leak/simulate-regression.sh
  ```

  It plants the exact mistake an agent makes into a real template route, runs the
  guard (which goes **red** and names the file), then reverts — leaving your tree
  clean.

## The sentence this earns

> *"Every tenant boundary is type-enforced, every scoped table has a cross-tenant
> leak test, and a cross-tenant read fails our build."*

A claim v0 / Lovable / Bolt cannot make. The mechanism is
[plans/33](../../plans/33-enforced-tenant-authorization-boundary.md).
