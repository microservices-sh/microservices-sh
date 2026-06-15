import { describe, it, expect } from "vitest";
import type { Result } from "@microservices-sh/connection-contract";
import {
  notify,
  listNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
  createMemoryNotificationStore
} from "./index";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

// Narrow a Result to its ok branch (use-cases return a discriminated union).
function data<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`expected ok result, got ${JSON.stringify(r.error)}`);
  return r.data;
}

describe("notifications-inapp: per-user isolation", () => {
  it("a list for user A never returns user B's items", async () => {
    const store = createMemoryNotificationStore();
    await notify({ userId: "A", type: "booking.confirmed", title: "A1" }, { store, now: fixedNow(T0) });
    await notify({ userId: "B", type: "booking.confirmed", title: "B1" }, { store, now: fixedNow(T0) });

    const listA = await listNotifications({ userId: "A" }, { store });
    expect(listA.ok).toBe(true);
    const titlesA = data(listA).notifications.map((n) => n.title);
    expect(titlesA).toEqual(["A1"]);
    expect(data(listA).notifications.every((n) => n.userId === "A")).toBe(true);
  });
});

describe("notifications-inapp: unread count + markRead/markAllRead", () => {
  it("counts unread accurately and updates on markRead and markAllRead", async () => {
    const store = createMemoryNotificationStore();
    const n1 = await notify({ userId: "A", type: "t" }, { store, now: fixedNow(T0) });
    const n2 = await notify({ userId: "A", type: "t" }, { store, now: fixedNow(T0 + 1000) });
    await notify({ userId: "A", type: "t" }, { store, now: fixedNow(T0 + 2000) });
    // Another user's notification must not pollute A's count.
    await notify({ userId: "B", type: "t" }, { store, now: fixedNow(T0) });

    expect(data(await getUnreadCount({ userId: "A" }, { store })).count).toBe(3);

    const mr = await markRead({ userId: "A", ids: [data(n1).id, data(n2).id] }, { store });
    expect(data(mr).updated).toBe(2);
    expect(data(await getUnreadCount({ userId: "A" }, { store })).count).toBe(1);

    const mar = await markAllRead({ userId: "A" }, { store });
    expect(data(mar).updated).toBe(1);
    expect(data(await getUnreadCount({ userId: "A" }, { store })).count).toBe(0);
    // B is untouched.
    expect(data(await getUnreadCount({ userId: "B" }, { store })).count).toBe(1);
  });

  it("markRead cannot flip another user's notifications", async () => {
    const store = createMemoryNotificationStore();
    const bItem = await notify({ userId: "B", type: "t" }, { store, now: fixedNow(T0) });
    // User A tries to mark B's notification read.
    const res = await markRead({ userId: "A", ids: [data(bItem).id] }, { store });
    expect(data(res).updated).toBe(0);
    expect(data(await getUnreadCount({ userId: "B" }, { store })).count).toBe(1);
  });
});

describe("notifications-inapp: sinceIso cursor", () => {
  it("returns only notifications newer than the cursor", async () => {
    const store = createMemoryNotificationStore();
    await notify({ userId: "A", type: "t", title: "old" }, { store, now: fixedNow(T0) });
    const cursorIso = new Date(T0 + 1000).toISOString();
    await notify({ userId: "A", type: "t", title: "mid" }, { store, now: fixedNow(T0 + 1000) });
    await notify({ userId: "A", type: "t", title: "new" }, { store, now: fixedNow(T0 + 2000) });

    const res = await listNotifications({ userId: "A", sinceIso: cursorIso }, { store });
    // sinceIso is strictly-after (createdAt > cursor), so the item AT the cursor
    // time is excluded; only the strictly-newer one is returned.
    const titles = data(res).notifications.map((n) => n.title);
    expect(titles).toEqual(["new"]);
  });
});

describe("notifications-inapp: idempotent notify", () => {
  it("the same dedupKey does not create a duplicate", async () => {
    const store = createMemoryNotificationStore();
    const first = await notify(
      { userId: "A", type: "payment.received", dedupKey: "evt-1" },
      { store, now: fixedNow(T0) }
    );
    expect(first.status).toBe(201);
    expect(data(first).deduped).toBe(false);

    const replay = await notify(
      { userId: "A", type: "payment.received", dedupKey: "evt-1" },
      { store, now: fixedNow(T0 + 1000) }
    );
    expect(replay.status).toBe(200);
    expect(data(replay).deduped).toBe(true);
    expect(data(replay).id).toBe(data(first).id);

    // Only one row persisted.
    const list = await listNotifications({ userId: "A" }, { store });
    expect(data(list).notifications).toHaveLength(1);

    // A different user with the same dedupKey is independent (per-user scope).
    const other = await notify(
      { userId: "B", type: "payment.received", dedupKey: "evt-1" },
      { store, now: fixedNow(T0) }
    );
    expect(data(other).deduped).toBe(false);
  });
});
