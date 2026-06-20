# Scaling on Cloudflare D1 — "We Outgrew D1"

*Audience: customers running a generated app in production, and anyone using "D1 won't scale" as a buy/no-buy objection.*

The short version: most apps that "outgrow D1" have a **query or schema problem**, not a platform problem. There is a clear, effort-ordered path that gets you a long way before D1 is genuinely the wrong tool — and because every module talks to data through a **port + drizzle adapter** (see [Module data-access standard](./module-data-access-standard.md)), the day you *do* move off D1, the change is localized to the adapter layer, not your use-cases or consumers.

## 1. What D1 actually limits today

D1 is SQLite-per-database. Its constraints are about **one database's size and a single writer**, not about total account scale.

| Limit | Workers Paid | Free | Notes |
|-------|--------------|------|-------|
| Max database size | 10 GB | 500 MB | Per database, not per account |
| Databases per account | 50,000 | 10 | Sharding/per-tenant DBs are first-class |
| Storage per account | 1 TB | 5 GB | |
| Max columns per table | 100 | 100 | |
| Max row size | 2 MB | 2 MB | strings/BLOBs/row |
| Queries per Worker invocation | 1,000 | 50 | |
| Max SQL statement length | 100 KB | 100 KB | |
| Max bound params per query | 100 | 100 | Batch large IN-lists |
| Max query duration | 30 s | 30 s | |
| Time Travel (PITR) | 30 days | 7 days | |

**Write throughput is the real ceiling.** Each D1 database is single-threaded and processes queries **sequentially**. Throughput is therefore a function of query duration: roughly **~1,000 queries/s for 1 ms queries, ~10 queries/s for 100 ms queries**. Fast queries scale; slow queries serialize behind each other. Reads can be fanned out with replication (path b); writes against one DB cannot.

> Numbers above reflect Cloudflare's published D1 limits as of 2026-06. **Verify against current Cloudflare D1 docs** (`developers.cloudflare.com/d1/platform/limits/`) before quoting them to a customer — Cloudflare raises these periodically.

## 2. Scaling paths, ordered by effort

Work down this list. Stop at the first path that buys enough headroom; don't jump to (e) because (a) was skipped.

### (a) Indexing + query hygiene — *do this first, always*
The cheapest 10–100x. Because D1 is single-threaded, **a slow query taxes every other query**, so query time is throughput.
- Add indexes for every `WHERE`/`JOIN`/`ORDER BY` you run hot; confirm with `EXPLAIN QUERY PLAN`.
- Kill N+1s — batch with `IN (...)` (mind the 100-param cap; chunk larger lists).
- Select only needed columns; avoid `SELECT *` on wide rows (2 MB row cap).
- Use `batch()` for multi-statement work instead of round-tripping per statement.
- **Trade-off:** none worth mentioning. This is hygiene, not architecture.

### (b) D1 read replication — *read-heavy apps*
D1 can serve reads from replicas in multiple regions while writes go to the primary.
- Lowers read latency globally and offloads read volume from the primary.
- **Trade-off:** replicas are eventually consistent — a read just after a write may be stale. Route read-your-own-write paths to the primary. Does **nothing** for write throughput (single writer remains).

### (c) Per-tenant Durable Object SQLite (facets) — *isolation + per-tenant scale*
Give each tenant (or each hot entity) its **own** DO-backed SQLite store. Each DO is its own single-threaded writer, so N tenants ≈ N independent write lanes, and one noisy tenant can't serialize behind another.
- Strong tenant isolation (blast radius, noisy-neighbor, per-tenant PITR/locality).
- Write throughput scales **horizontally** with tenant count.
- **Trade-off (important):** you lose cheap **cross-tenant SQL**. "Top customers across all tenants" is no longer one query — it becomes fan-out + aggregate, or a separate analytics/rollup store. Pick this when tenants are naturally siloed and cross-tenant reporting is rare or can live elsewhere.

### (d) Sharding across multiple D1 databases — *one logical dataset too big/hot for one DB*
Split rows across many D1 databases by a shard key (tenant id, hash, range). The 50,000-DB ceiling makes this practical.
- Gets past the 10 GB/DB cap and spreads writes across multiple single-threaded writers.
- **Trade-off:** you now own a shard map and routing logic; cross-shard queries and transactions are app-level (fan-out, scatter-gather). Re-sharding is migration work. More moving parts than (c) for the same cross-cutting-query pain.

### (e) Move off D1 to hosted Postgres — *when the workload is genuinely relational-at-scale*
Reach for this when you need **high-concurrency writes to one logical dataset with rich cross-cutting queries** — i.e. the thing (c) and (d) make expensive. Signals: sustained write contention on a single hot dataset, heavy multi-table analytical joins across all tenants, or you've already sharded and the shard map is the bottleneck.
- **Why it's not a rewrite here:** modules depend on a **repository port**, with drizzle as an *adapter detail* behind it (`d1-<x>-repository.ts`). Swapping D1 for Postgres means writing a `pg-<x>-repository.ts` against the same port (drizzle has a Postgres driver) and pointing the binding at it. Use-cases and consumers don't change — the swap is **localized to the adapter layer**.
- **Trade-off:** you leave Cloudflare's serverless data plane — connection pooling, a managed Postgres, latency from the edge to the DB region, and ops you didn't have on D1. Don't do this for headroom you can get from (a)–(d).

## 3. Decision table: app profile → recommended path

| App profile | Symptom | Start at | Then consider |
|-------------|---------|----------|---------------|
| Most apps, "feels slow" | Hot endpoints slow under load | **(a)** indexing/hygiene | — usually enough |
| Read-heavy, global users | Read latency / read volume dominates | **(a)** then **(b)** replication | (c) if also multi-tenant |
| Multi-tenant SaaS, siloed tenants | Noisy neighbor, isolation/compliance needs | **(c)** DO-per-tenant | (d) if a single tenant outgrows one store |
| One big shared dataset, write-hot | Single-writer serialization on one DB | **(a)** then **(d)** sharding | (e) if cross-shard queries dominate |
| Heavy cross-tenant analytics + high write concurrency | Joins across all tenants are core, writes contend | **(e)** hosted Postgres | keep operational data on D1, analytics on PG |
| Approaching 10 GB on one DB | Single DB nearing size cap | **(d)** shard or **(c)** per-tenant | (e) only if also relational-at-scale |

## Honest limits

- **D1 is not the bottleneck for most apps that think it is.** Skipping (a) and blaming the platform is the common failure mode.
- **(c) trades cross-tenant queryability for isolation and write scale** — don't pick it if all-tenant reporting is a core feature.
- **(d) adds operational surface** (shard map, routing, re-sharding) you have to own and test.
- **(e) is a real platform change**, not a config flag — but the port/adapter design means it's an *adapter swap plus an ops migration*, not an app rewrite. That localization is the point: choose the data plane per workload without rewriting business logic.
