# Module data-access standard

*Status: adopted 2026-06-19. Reference implementation: `modules/booking`.*

How a module talks to D1. The goal is one consistent, typed, testable shape across
modules — without giving up the ports/adapters design that makes modules portable.

## The shape

```
use-cases  ──depend on──▶  Repository PORT (interface)
                                 ▲                 ▲
                  ┌──────────────┘                 └──────────────┐
        d1-<x>-repository.ts                          memory-<x>-repository.ts
        (drizzle-orm/d1)                              (plain JS, for fast unit tests)
```

1. **Port stays the contract.** Use-cases depend only on the repository interface in
   `src/ports`. The ORM is an *adapter detail* — swapping it never touches use-cases
   or consumers.
2. **D1 adapter uses `drizzle-orm/d1`.** Define the module's tables as a Drizzle
   schema in `src/db/schema.ts`; write the adapter with the typed query builder.
3. **Memory adapter is unchanged.** Keep the plain in-memory repository for fast
   use-case unit tests. Drizzle does not replace it.
4. **Test the D1 adapter against a real engine** via `@microservices-sh/test-utils`
   (`createTestD1`). See "Testing" below — this part is mandatory and non-obvious.

## Why these exact choices

- **Drizzle behind the port, not over it.** Consumers depend on the contract, so the
  ORM coupling is internal and reversible. You get typed queries (the column/type
  drift class becomes a compile error) without leaking the ORM into the module's API.
- **`better-sqlite3` for tests, NOT `node:sqlite`.** `drizzle-orm/d1` reads results
  through D1's *positional* `.raw()` (`unknown[][]`). `node:sqlite` only returns row
  *objects*, which collapse duplicate column names — so a join selecting
  `services.name` and `customers.name` loses one column and drizzle maps fields
  wrongly. `better-sqlite3` exposes a real positional `.raw()`, reproducing D1
  exactly (joins included). `createTestD1` wraps it in the D1 interface.

## Testing

```ts
import { createTestD1 } from "@microservices-sh/test-utils";
const { d1, sqlite } = createTestD1(SCHEMA_SQL, SEED_SQL);
const repo = createD1XRepository(d1);          // exercise the real adapter SQL
// `sqlite` is the raw better-sqlite3 handle for direct assertion queries.
```

- `SCHEMA_SQL` must mirror the module's migrations (and any cross-module table it
  joins). Keep it in sync with `migrations/*.sql`.
- **Constraint violations** surface as `DrizzleQueryError`; the driver error is on
  `.cause`. Assert there, not on the wrapper message:
  ```ts
  const err = await repo.create(dup).catch((e) => e);
  expect(String(err.cause ?? err)).toMatch(/unique|constraint/i);
  ```

## CI / install

`better-sqlite3` is a **native** dependency. It is listed in the root
`pnpm.onlyBuiltDependencies` so `pnpm install` compiles its binding; CI runners need
a build toolchain (default on GitHub `ubuntu-latest`).

## Honest limits

- **Not a drift gate for modules.** A module does NOT own its schema — the consuming
  app creates the tables. So a module's Drizzle schema is an *assertion* of the
  app-provided shape, not an authoritative source like the app's own `schema.sql`
  (which *can* run a real drift gate — see `api`). Modules get typed queries; they do
  not get drift detection against a truth.
- **Cross-module tables get re-declared.** `booking` re-declares `customers` (owned by
  the customer module) to join it. If this spreads, factor shared tables into a small
  schema package rather than duplicating per module.

## Scope / rollout

- **New modules:** start from this shape (the scaffold's adapter/test READMEs point
  here; copy `modules/booking`).
- **Existing modules:** migrate **opportunistically** when a module is touched for
  other reasons — no big-bang rewrite. They work today; there is no functional gain
  from converting in bulk.
- **Exempt — generic/registry modules** (e.g. `admin-shell`): these operate over
  *arbitrary* consumer tables defined at runtime, so they have no fixed schema to
  model in Drizzle. They keep their parameterized gateway + adapter-parity test.
