import { describe, it, expect } from "vitest";
import { authContext } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import {
  addTicketComment,
  addTicketCommentScoped,
  attachTicketFile,
  createTicket,
  createTicketShareToken,
  createTicketShareTokenScoped,
  getTicket,
  listTicketThread,
  listTickets,
  resolveTicketShareToken,
  revokeTicketShareToken,
  updateTicket,
  createTicketScoped,
  getTicketScoped,
  listTicketsScoped,
  updateTicketScoped,
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
    expect(ticket.ticketNumber).toBe(1);
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

  it("assigns sequential ticket numbers per tenant", async () => {
    const store = createMemoryTicketStore();
    const d = { store, now: fixedNow(T0) };
    const a1 = await createTicket({ ...baseInput, tenantId: "tenant-a", subject: "A1" }, d);
    const a2 = await createTicket({ ...baseInput, tenantId: "tenant-a", subject: "A2" }, d);
    const b1 = await createTicket({ ...baseInput, tenantId: "tenant-b", subject: "B1" }, d);

    if (!a1.ok || !a2.ok || !b1.ok) throw new Error("setup failed");
    expect(a1.data.ticket.ticketNumber).toBe(1);
    expect(a2.data.ticket.ticketNumber).toBe(2);
    expect(b1.data.ticket.ticketNumber).toBe(1);
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

describe("support-ticket: comments, attachments, and share tokens", () => {
  it("records public/internal comments and attachment metadata", async () => {
    const store = createMemoryTicketStore();
    const d = { store, now: fixedNow(T0) };
    const created = await createTicket(baseInput, d);
    if (!created.ok) throw new Error("setup failed");
    const ticketId = created.data.ticket.id;

    const customerComment = await addTicketComment(
      {
        ticketId,
        authorType: "customer",
        authorName: "Customer",
        authorEmail: "Customer@Example.com",
        content: "Here is the screenshot."
      },
      { ...d, id: () => "comment-public" }
    );
    expect(customerComment.ok).toBe(true);
    if (customerComment.ok) {
      expect(customerComment.data.comment.authorEmail).toBe("customer@example.com");
      expect(customerComment.data.event.name).toBe("support-ticket.comment.created");
    }

    await addTicketComment(
      {
        ticketId,
        authorType: "agent",
        authorName: "Agent",
        content: "Internal escalation note.",
        isInternal: true
      },
      { ...d, id: () => "comment-internal" }
    );

    const attachment = await attachTicketFile(
      {
        ticketId,
        filename: "screenshot.png",
        contentType: "image/png",
        sizeBytes: 1024,
        storageKey: "tickets/tkt_1/screenshot.png"
      },
      { ...d, id: () => "attachment-1" }
    );
    expect(attachment.ok).toBe(true);

    const publicThread = await listTicketThread({ ticketId }, d);
    expect(publicThread.ok).toBe(true);
    if (publicThread.ok) {
      expect(publicThread.data.comments).toHaveLength(1);
      expect(publicThread.data.attachments).toHaveLength(1);
    }

    const adminThread = await listTicketThread({ ticketId, includeInternal: true }, d);
    if (adminThread.ok) expect(adminThread.data.comments).toHaveLength(2);
  });

  it("resolves and revokes public share-token snapshots", async () => {
    const store = createMemoryTicketStore();
    const d = { store, now: fixedNow(T0) };
    const created = await createTicket(baseInput, d);
    if (!created.ok) throw new Error("setup failed");
    const ticketId = created.data.ticket.id;
    await addTicketComment(
      { ticketId, authorType: "customer", authorName: "Customer", content: "Follow-up detail." },
      { ...d, id: () => "comment-1" }
    );
    await attachTicketFile(
      {
        ticketId,
        filename: "detail.txt",
        contentType: "text/plain",
        sizeBytes: 10,
        storageKey: "tickets/tkt_1/detail.txt"
      },
      { ...d, id: () => "attachment-1" }
    );

    const share = await createTicketShareToken(
      {
        ticketId,
        expiresAt: "2026-01-02T00:00:00.000Z"
      },
      { ...d, id: () => "share-1", token: () => "sharetoken1" }
    );
    expect(share.ok).toBe(true);
    if (!share.ok) throw new Error("share setup failed");

    const resolved = await resolveTicketShareToken(
      { token: "sharetoken1" },
      { store, now: fixedNow(T0 + 1000) }
    );
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.data.snapshot.ticket.id).toBe(ticketId);
      expect(resolved.data.snapshot.comments).toHaveLength(1);
      expect(resolved.data.snapshot.attachments).toHaveLength(1);
      expect(resolved.data.snapshot.shareToken.lastAccessedAt).toBe(new Date(T0 + 1000).toISOString());
    }

    const revoked = await revokeTicketShareToken({ id: share.data.shareToken.id }, d);
    expect(revoked.ok).toBe(true);
    const afterRevoke = await resolveTicketShareToken({ token: "sharetoken1" }, d);
    expect(afterRevoke.ok).toBe(false);
    if (!afterRevoke.ok) expect(afterRevoke.status).toBe(404);
  });

  it("rejects expired share tokens", async () => {
    const store = createMemoryTicketStore();
    const created = await createTicket(baseInput, { store, now: fixedNow(T0) });
    if (!created.ok) throw new Error("setup failed");
    await createTicketShareToken(
      {
        ticketId: created.data.ticket.id,
        expiresAt: "2025-12-31T23:59:59.000Z"
      },
      { store, now: fixedNow(T0), id: () => "share-expired", token: () => "expiredtoken" }
    );

    const resolved = await resolveTicketShareToken(
      { token: "expiredtoken" },
      { store, now: fixedNow(T0) }
    );
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.status).toBe(410);
  });
});

// plans/33 — the enforced authorization boundary. This is the CI artifact we
// show buyers: seed two tenants, act as one, prove zero cross-tenant access.
describe("support-ticket: enforced tenant boundary (cross-tenant leak test)", () => {
  it("an actor scoped to org A can never read, list, or write org B's tickets", async () => {
    const store = createMemoryTicketStore();
    const d = { store, now: fixedNow(T0) };
    const ctxA = authContext({ orgId: "tenant-1", actorId: "agent-a" });

    // Two tenants share one store (one deployment's D1). Seed via the legacy,
    // input-trusting createTicket to simulate data already at rest.
    const a1 = await createTicket({ ...baseInput, tenantId: "tenant-1", subject: "A1" }, d);
    await createTicket({ ...baseInput, tenantId: "tenant-1", subject: "A2" }, d);
    const b1 = await createTicket({ ...baseInput, tenantId: "tenant-2", subject: "B1" }, d);
    if (!a1.ok || !b1.ok) throw new Error("seed failed");

    // LIST as A returns only A's rows — even when a forged tenantId is supplied.
    const listed = await listTicketsScoped(ctxA, { tenantId: "tenant-2" }, d);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.count).toBe(2);
      expect(listed.data.tickets.every((t) => t.tenantId === "tenant-1")).toBe(true);
    }

    // GET: A's own ticket resolves; B's id is reported not-found (no disclosure).
    const ownGet = await getTicketScoped(ctxA, { id: a1.data.ticket.id }, d);
    expect(ownGet.ok).toBe(true);
    const foreignGet = await getTicketScoped(ctxA, { id: b1.data.ticket.id }, d);
    expect(foreignGet.ok).toBe(false);
    expect(foreignGet.status).toBe(404);

    // UPDATE: writing B's ticket is refused and leaves it unchanged.
    const foreignWrite = await updateTicketScoped(ctxA, { id: b1.data.ticket.id, status: "closed" }, d);
    expect(foreignWrite.ok).toBe(false);
    expect(foreignWrite.status).toBe(404);
    const bStill = await getTicket({ id: b1.data.ticket.id }, d);
    if (bStill.ok) expect(bStill.data.ticket.status).toBe("open");

    // CREATE as A while forging tenant-2 still stamps the ticket with tenant-1.
    const opened = await createTicketScoped(ctxA, { ...baseInput, tenantId: "tenant-2", subject: "A3" }, d);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.data.ticket.tenantId).toBe("tenant-1");

    // A call lacking an org scope is refused (403), not run against an unknown tenant.
    const noScope = await listTicketsScoped(
      { orgId: "", actorId: "x", roles: [] } as unknown as AuthContext,
      {},
      d
    );
    expect(noScope.ok).toBe(false);
    expect(noScope.status).toBe(403);
  });

  it("scopes comments and share-token admin actions to the active tenant", async () => {
    const store = createMemoryTicketStore();
    const d = { store, now: fixedNow(T0) };
    const ctxA = authContext({ orgId: "tenant-1", actorId: "agent-a" });

    const a1 = await createTicket({ ...baseInput, tenantId: "tenant-1", subject: "A1" }, d);
    const b1 = await createTicket({ ...baseInput, tenantId: "tenant-2", subject: "B1" }, d);
    if (!a1.ok || !b1.ok) throw new Error("seed failed");

    const foreignComment = await addTicketCommentScoped(
      ctxA,
      { ticketId: b1.data.ticket.id, authorType: "agent", content: "nope" },
      d
    );
    expect(foreignComment.ok).toBe(false);
    expect(foreignComment.status).toBe(404);

    const ownShare = await createTicketShareTokenScoped(
      ctxA,
      { ticketId: a1.data.ticket.id },
      { ...d, id: () => "share-tenant-1", token: () => "tenant1share" }
    );
    expect(ownShare.ok).toBe(true);

    const foreignShare = await createTicketShareTokenScoped(
      ctxA,
      { ticketId: b1.data.ticket.id },
      { ...d, id: () => "share-tenant-2", token: () => "tenant2share" }
    );
    expect(foreignShare.ok).toBe(false);
    expect(foreignShare.status).toBe(404);
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
