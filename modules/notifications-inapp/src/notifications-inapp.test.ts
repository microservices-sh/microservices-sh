import { describe, it, expect } from "vitest";
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

describe("notifications-inapp: per-user isolation", () => {
  it("a list for user A never returns user B's items", async () => {
    const store = createMemoryNotificationStore();
    await notify({ userId: "A", type: "booking.confirmed", title: "A1" }, { store, now: fixedNow(T0) });
    await notify({ userId: "B", type: "booking.confirmed", title: "B1" }, { store, now: fixedNow(T0) });

    const listA = await listNotifications({ userId: "A" }, { store });
    expect(listA.ok).toBe(true);
    const titlesA = listA.data!.notifications.map((n) => n.title);
    expect(titlesA).toEqual(["A1"]);
    expect(listA.data!.notifications.every((n) => n.userId === "A")).toBe(true);
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

    expect((await getUnreadCount({ userId: "A" }, { store })).data?.count).toBe(3);

    const mr = await markRead({ userId: "A", ids: [n1.data!.id, n2.data!.id] }, { store });
    expect(mr.data?.updated).toBe(2);
    expect((await getUnreadCount({ userId: "A" }, { store })).data?.count).toBe(1);

    const mar = await markAllRead({ userId: "A" }, { store });
    expect(mar.data?.updated).toBe(1);
    expect((await getUnreadCount({ userId: "A" }, { store })).data?.count).toBe(0);
    // B is untouched.
    expect((await getUnreadCount({ userId: "B" }, { store })).data?.count).toBe(1);
  });

  it("markRead cannot flip another user's notifications", async () => {
    const store = createMemoryNotificationStore();
    const bItem = await notify({ userId: "B", type: "t" }, { store, now: fixedNow(T0) });
    // User A tries to mark B's notification read.
    const res = await markRead({ userId: "A", ids: [bItem.data!.id] }, { store });
    expect(res.data?.updated).toBe(0);
    expect((await getUnreadCount({ userId: "B" }, { store })).data?.count).toBe(1);
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
    const titles = res.data!.notifications.map((n) => n.title);
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
    expect(first.data?.deduped).toBe(false);

    const replay = await notify(
      { userId: "A", type: "payment.received", dedupKey: "evt-1" },
      { store, now: fixedNow(T0 + 1000) }
    );
    expect(replay.status).toBe(200);
    expect(replay.data?.deduped).toBe(true);
    expect(replay.data?.id).toBe(first.data?.id);

    // Only one row persisted.
    const list = await listNotifications({ userId: "A" }, { store });
    expect(list.data!.notifications).toHaveLength(1);

    // A different user with the same dedupKey is independent (per-user scope).
    const other = await notify(
      { userId: "B", type: "payment.received", dedupKey: "evt-1" },
      { store, now: fixedNow(T0) }
    );
    expect(other.data?.deduped).toBe(false);
  });
});
