import { describe, it, expect } from "vitest";
import {
  createTicket,
  getTicket,
  listTickets,
  updateTicket,
  createMemoryTicketStore
} from "./index";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

const baseInput = {
  tenantId: "tenant-1",
  subject: "Cannot log in",
  description: "The login page returns a 500.",
  requesterEmail: "User@Example.com"
};

function deps(now = fixedNow(T0)) {
  return { store: createMemoryTicketStore(), now };
}

describe("support-ticket: create -> get", () => {
  it("creates a ticket with defaults and reads it back", async () => {
    const d = deps();
    const created = await createTicket(baseInput, { ...d, correlationId: "corr-1" });

    expect(created.ok).toBe(true);
    expect(created.status).toBe(201);
    expect(created.meta.correlationId).toBe("corr-1");
    if (!created.ok) throw new Error("create failed");

    const ticket = created.data.ticket;
    expect(ticket.status).toBe("open"); // default
    expect(ticket.priority).toBe("normal"); // default
    expect(ticket.assigneeId).toBe(null);
    expect(ticket.requesterEmail).toBe("user@example.com"); // normalized by hook
    expect(ticket.createdAt).toBe(new Date(T0).toISOString());

    // created event threads the correlationId
    expect(created.data.event.name).toBe("support-ticket.created");
    expect(created.data.event.correlationId).toBe("corr-1");

    const got = await getTicket({ id: ticket.id }, d);
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.data.ticket.id).toBe(ticket.id);
  });

  it("get returns 404 for an unknown id", async () => {
    const got = await getTicket({ id: "missing" }, deps());
    expect(got.ok).toBe(false);
    expect(got.status).toBe(404);
    if (!got.ok) expect(got.error.code).toBe("support-ticket.TICKET_NOT_FOUND");
  });
});

describe("support-ticket: list", () => {
  it("filters by status and is tenant-isolated", async () => {
    const store = createMemoryTicketStore();
    const d = { store, now: fixedNow(T0) };

    await createTicket({ ...baseInput, tenantId: "tenant-1", subject: "A" }, d);
    await createTicket(
      { ...baseInput, tenantId: "tenant-1", subject: "B", status: "closed" },
      d
    );
    await createTicket({ ...baseInput, tenantId: "tenant-2", subject: "C" }, d);

    const all1 = await listTickets({ tenantId: "tenant-1" }, d);
    expect(all1.ok).toBe(true);
    if (all1.ok) {
      expect(all1.data.count).toBe(2);
      // tenant isolation: tenant-2 ticket must not leak in
      expect(all1.data.tickets.every((t) => t.tenantId === "tenant-1")).toBe(true);
    }

    const open1 = await listTickets({ tenantId: "tenant-1", status: "open" }, d);
    if (open1.ok) {
      expect(open1.data.count).toBe(1);
      expect(open1.data.tickets[0].subject).toBe("A");
    }

    const t2 = await listTickets({ tenantId: "tenant-2" }, d);
    if (t2.ok) expect(t2.data.count).toBe(1);
  });
});

describe("support-ticket: update", () => {
  it("updates status/priority/assignee and emits status_changed on transition", async () => {
    const store = createMemoryTicketStore();
    const created = await createTicket(baseInput, { store, now: fixedNow(T0) });
    if (!created.ok) throw new Error("setup failed");
    const id = created.data.ticket.id;

    const updated = await updateTicket(
      { id, status: "pending", priority: "high", assigneeId: "agent-7" },
      { store, now: fixedNow(T0 + 1000), correlationId: "corr-2" }
    );

    expect(updated.ok).toBe(true);
    if (!updated.ok) throw new Error("update failed");
    expect(updated.data.ticket.status).toBe("pending");
    expect(updated.data.ticket.priority).toBe("high");
    expect(updated.data.ticket.assigneeId).toBe("agent-7");
    expect(updated.data.ticket.updatedAt).toBe(new Date(T0 + 1000).toISOString());
    expect(updated.data.statusChanged).toBe(true);

    const names = updated.data.events.map((e) => e.name);
    expect(names).toContain("support-ticket.updated");
    expect(names).toContain("support-ticket.status_changed");
    const changed = updated.data.events.find((e) => e.name === "support-ticket.status_changed");
    expect(changed?.payload).toMatchObject({ from: "open", to: "pending" });
    expect(changed?.correlationId).toBe("corr-2");
  });

  it("does not emit status_changed when status is unchanged", async () => {
    const store = createMemoryTicketStore();
    const created = await createTicket(baseInput, { store, now: fixedNow(T0) });
    if (!created.ok) throw new Error("setup failed");
    const id = created.data.ticket.id;

    const updated = await updateTicket({ id, priority: "urgent" }, { store, now: fixedNow(T0 + 1) });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.statusChanged).toBe(false);
    expect(updated.data.events.map((e) => e.name)).toEqual(["support-ticket.updated"]);
  });

  it("can clear an assignee with null", async () => {
    const store = createMemoryTicketStore();
    const created = await createTicket(
      { ...baseInput, assigneeId: "agent-1" },
      { store, now: fixedNow(T0) }
    );
    if (!created.ok) throw new Error("setup failed");
    expect(created.data.ticket.assigneeId).toBe("agent-1");

    const cleared = await updateTicket(
      { id: created.data.ticket.id, assigneeId: null },
      { store, now: fixedNow(T0 + 1) }
    );
    if (cleared.ok) expect(cleared.data.ticket.assigneeId).toBe(null);
  });

  it("returns 404 when updating an unknown ticket", async () => {
    const r = await updateTicket({ id: "missing", status: "closed" }, deps());
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
    if (!r.ok) expect(r.error.code).toBe("support-ticket.TICKET_NOT_FOUND");
  });
});

describe("support-ticket: validation", () => {
  it("rejects an empty subject", async () => {
    const r = await createTicket({ ...baseInput, subject: "" }, deps());
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    if (!r.ok) expect(r.error.code).toBe("support-ticket.INVALID_TICKET_INPUT");
  });

  it("rejects an invalid status", async () => {
    const r = await createTicket({ ...baseInput, status: "archived" }, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("support-ticket.INVALID_TICKET_INPUT");
  });

  it("rejects an invalid priority", async () => {
    const r = await createTicket({ ...baseInput, priority: "blocker" }, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("support-ticket.INVALID_TICKET_INPUT");
  });

  it("rejects an invalid requester email", async () => {
    const r = await createTicket({ ...baseInput, requesterEmail: "not-an-email" }, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("support-ticket.INVALID_TICKET_INPUT");
  });

  it("rejects an update with no fields to change", async () => {
    const store = createMemoryTicketStore();
    const created = await createTicket(baseInput, { store, now: fixedNow(T0) });
    if (!created.ok) throw new Error("setup failed");
    const r = await updateTicket({ id: created.data.ticket.id }, { store });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    if (!r.ok) expect(r.error.code).toBe("support-ticket.INVALID_TICKET_INPUT");
  });
});
