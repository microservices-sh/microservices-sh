import { describe, expect, it } from "vitest";
import {
  claimIdempotency,
  completeIdempotency,
  createMemoryIdempotencyStore,
  failIdempotency,
  pruneExpiredRecords
} from "./index";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

type ResultLike = { ok: true; data: unknown } | { ok: false; error: unknown };

function data<R extends ResultLike>(result: R): Extract<R, { ok: true }>["data"] {
  if (!result.ok) throw new Error(`expected ok result, got ${JSON.stringify(result.error)}`);
  return result.data as Extract<R, { ok: true }>["data"];
}

describe("idempotency: claim", () => {
  it("claims once, then reports the duplicate as in-progress", async () => {
    const store = createMemoryIdempotencyStore();
    const first = await claimIdempotency(
      { scope: "payment.intent", key: "idem-1", requestHash: "hash-a" },
      { store, now: fixedNow(T0) }
    );
    expect(first.status).toBe(201);
    expect(data(first).action).toBe("claimed");
    expect(data(first).replayed).toBe(false);

    const duplicate = await claimIdempotency(
      { scope: "payment.intent", key: "idem-1", requestHash: "hash-a" },
      { store, now: fixedNow(T0 + 1_000) }
    );
    expect(duplicate.status).toBe(202);
    expect(data(duplicate).action).toBe("in_progress");
    expect(data(duplicate).record.id).toBe(data(first).record.id);
  });

  it("rejects reuse of a key with a different request hash", async () => {
    const store = createMemoryIdempotencyStore();
    await claimIdempotency({ scope: "webhook.stripe", key: "evt-1", requestHash: "hash-a" }, { store, now: fixedNow(T0) });

    const conflict = await claimIdempotency(
      { scope: "webhook.stripe", key: "evt-1", requestHash: "hash-b" },
      { store, now: fixedNow(T0 + 1_000) }
    );
    expect(conflict.ok).toBe(false);
    expect(conflict.status).toBe(409);
    if (!conflict.ok) expect(conflict.error.code).toBe("idempotency.KEY_REUSED_WITH_DIFFERENT_REQUEST");
  });

  it("reclaims a stale in-progress lock after lockTtlMs", async () => {
    const store = createMemoryIdempotencyStore();
    const first = await claimIdempotency(
      { scope: "jobs.email", key: "send-1", lockTtlMs: 10_000, ttlMs: 60_000 },
      { store, now: fixedNow(T0) }
    );
    const firstId = data(first).record.id;

    const reclaimed = await claimIdempotency(
      { scope: "jobs.email", key: "send-1", lockTtlMs: 10_000, ttlMs: 60_000 },
      { store, now: fixedNow(T0 + 10_001) }
    );
    expect(reclaimed.status).toBe(201);
    expect(data(reclaimed).action).toBe("claimed");
    expect(data(reclaimed).record.id).not.toBe(firstId);
  });
});

describe("idempotency: replay after terminal states", () => {
  it("replays a completed response without creating a second claim", async () => {
    const store = createMemoryIdempotencyStore();
    await claimIdempotency({ scope: "forms.submit", key: "sub-1" }, { store, now: fixedNow(T0) });
    const completed = await completeIdempotency(
      { scope: "forms.submit", key: "sub-1", response: { submissionId: "s1" }, statusCode: 201 },
      { store, now: fixedNow(T0 + 100) }
    );
    expect(data(completed).record.status).toBe("completed");

    const replay = await claimIdempotency({ scope: "forms.submit", key: "sub-1" }, { store, now: fixedNow(T0 + 200) });
    expect(replay.status).toBe(200);
    expect(data(replay).action).toBe("replayed");
    expect(data(replay).record.response).toEqual({ submissionId: "s1" });
  });

  it("replays a failed result and refuses to complete it later", async () => {
    const store = createMemoryIdempotencyStore();
    await claimIdempotency({ scope: "webhook.partner", key: "evt-2" }, { store, now: fixedNow(T0) });
    const failed = await failIdempotency(
      { scope: "webhook.partner", key: "evt-2", error: { code: "UPSTREAM_TIMEOUT" }, statusCode: 504 },
      { store, now: fixedNow(T0 + 100) }
    );
    expect(data(failed).record.status).toBe("failed");

    const replay = await claimIdempotency({ scope: "webhook.partner", key: "evt-2" }, { store, now: fixedNow(T0 + 200) });
    expect(data(replay).action).toBe("replayed");
    expect(data(replay).record.error).toEqual({ code: "UPSTREAM_TIMEOUT" });

    const lateComplete = await completeIdempotency({ scope: "webhook.partner", key: "evt-2" }, { store });
    expect(lateComplete.ok).toBe(false);
    expect(lateComplete.status).toBe(409);
  });
});

describe("idempotency: cleanup", () => {
  it("prunes expired records only", async () => {
    const store = createMemoryIdempotencyStore();
    await claimIdempotency({ scope: "booking.create", key: "old", ttlMs: 1_000 }, { store, now: fixedNow(T0) });
    await claimIdempotency({ scope: "booking.create", key: "new", ttlMs: 60_000 }, { store, now: fixedNow(T0) });

    const pruned = await pruneExpiredRecords({}, { store, now: fixedNow(T0 + 2_000) });
    expect(data(pruned).pruned).toBe(1);

    const oldAgain = await claimIdempotency({ scope: "booking.create", key: "old" }, { store, now: fixedNow(T0 + 3_000) });
    expect(data(oldAgain).action).toBe("claimed");

    const newAgain = await claimIdempotency({ scope: "booking.create", key: "new" }, { store, now: fixedNow(T0 + 3_000) });
    expect(data(newAgain).action).toBe("in_progress");
  });
});
