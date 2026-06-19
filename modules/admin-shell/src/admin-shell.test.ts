import { describe, it, expect } from "vitest";
import {
  createResourceRegistry,
  listRecords,
  getRecord,
  deleteRecord,
  updateRecord,
  createMemoryTableGateway
} from "./index";
import type { AdminActor, ResourceDefinition } from "./types";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

const widgetDef: ResourceDefinition = {
  name: "widget",
  table: "widgets",
  primaryKey: "id",
  columns: [
    { name: "id", type: "string" },
    { name: "name", type: "string", editable: true },
    { name: "createdBy", type: "string", editable: false },
    { name: "deleted_at", type: "datetime" }
  ],
  permissions: { read: "widget.read", write: "widget.write" },
  softDelete: { column: "deleted_at", deletedValue: "1" }
};

const registry = createResourceRegistry([widgetDef]);

const readerActor: AdminActor = { id: "u-reader", permissions: ["widget.read"] };
const writerActor: AdminActor = { id: "u-writer", permissions: ["widget.read", "widget.write"] };
const noneActor: AdminActor = { id: "u-none", permissions: [] };

describe("admin-shell: listRecords RBAC", () => {
  it("returns 403 without the read permission", async () => {
    const gateway = createMemoryTableGateway({ widgets: [{ id: "w1", name: "A" }] });
    const res = await listRecords(registry, "widget", {}, { gateway, actor: noneActor });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    if (!res.ok) expect(res.error.code).toBe("admin-shell.FORBIDDEN");
  });

  it("returns rows for an actor with read permission", async () => {
    const gateway = createMemoryTableGateway({ widgets: [{ id: "w1", name: "A" }] });
    const res = await listRecords(registry, "widget", {}, { gateway, actor: readerActor });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.rows.length).toBe(1);
  });
});

describe("admin-shell: deleteRecord soft-delete", () => {
  it("soft-deletes when softDelete is configured and excludes the row from the default list", async () => {
    const gateway = createMemoryTableGateway({
      widgets: [
        { id: "w1", name: "A" },
        { id: "w2", name: "B" }
      ]
    });

    const del = await deleteRecord(registry, "widget", "w1", { gateway, actor: writerActor, now: fixedNow(T0) });
    expect(del.ok).toBe(true);
    if (del.ok) expect(del.data.mode).toBe("soft");

    // Row still physically present (soft delete), but flagged.
    const raw = await gateway.get(widgetDef, "w1");
    expect(raw).not.toBeNull();
    expect(raw?.deleted_at).toBe("1");

    // Default list (read-only actor) excludes the soft-deleted row.
    const list = await listRecords(registry, "widget", {}, { gateway, actor: writerActor });
    if (!list.ok) throw new Error("expected list to succeed");
    const ids = list.data.rows.map((r) => r.id);
    expect(ids).toContain("w2");
    expect(ids).not.toContain("w1");
  });
});

describe("admin-shell: update rejects non-editable field", () => {
  it("rejects an update that targets a non-editable column", async () => {
    const gateway = createMemoryTableGateway({ widgets: [{ id: "w1", name: "A", createdBy: "system" }] });

    const res = await updateRecord(
      registry,
      "widget",
      "w1",
      { createdBy: "attacker" },
      { gateway, actor: writerActor, now: fixedNow(T0) }
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    if (!res.ok) {
      expect(res.error.code).toBe("admin-shell.VALIDATION_FAILED");
      expect(res.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ column: "createdBy", message: "is not editable" })])
      );
    }
  });

  it("allows an update to an editable column", async () => {
    const gateway = createMemoryTableGateway({ widgets: [{ id: "w1", name: "A" }] });
    const res = await updateRecord(
      registry,
      "widget",
      "w1",
      { name: "renamed" },
      { gateway, actor: writerActor, now: fixedNow(T0) }
    );
    expect(res.ok).toBe(true);
    const raw = await gateway.get(widgetDef, "w1");
    expect(raw?.name).toBe("renamed");
  });
});

// A resource with a read-only computed column. The D1 gateway derives this in SQL
// (a subquery aliased AS the column); the memory gateway derives it via the
// injected compute fn so behaviour is unit-testable without a D1 harness.
const accountDef: ResourceDefinition = {
  name: "account",
  table: "accounts",
  primaryKey: "id",
  columns: [
    { name: "id", type: "string" },
    { name: "email", type: "string", editable: true }
  ],
  computed: [{ name: "order_count", type: "number", expression: "(SELECT COUNT(*) FROM orders o WHERE o.account_id = accounts.id)" }],
  searchable: ["email"],
  permissions: { read: "account.read", write: "account.write" }
};
const accountRegistry = createResourceRegistry([accountDef]);
const accountWriter: AdminActor = { id: "u-aw", permissions: ["account.read", "account.write"] };

// Memory equivalents of the SQL expression: COUNT of orders per account.
function accountGateway() {
  const orders = [
    { id: "o1", account_id: "a1" },
    { id: "o2", account_id: "a1" },
    { id: "o3", account_id: "a2" }
  ];
  return createMemoryTableGateway(
    { accounts: [{ id: "a1", email: "one@x.com" }, { id: "a2", email: "two@x.com" }] },
    { order_count: (row) => orders.filter((o) => o.account_id === row.id).length }
  );
}

describe("admin-shell: computed columns", () => {
  it("projects the computed column on list", async () => {
    const res = await listRecords(accountRegistry, "account", { sort: { column: "id", direction: "asc" } }, { gateway: accountGateway(), actor: accountWriter });
    if (!res.ok) throw new Error("expected list to succeed");
    const a1 = res.data.rows.find((r) => r.id === "a1");
    expect(a1?.order_count).toBe(2);
    const a2 = res.data.rows.find((r) => r.id === "a2");
    expect(a2?.order_count).toBe(1);
  });

  it("projects the computed column on get", async () => {
    const res = await getRecord(accountRegistry, "account", "a1", { gateway: accountGateway(), actor: accountWriter });
    if (!res.ok) throw new Error("expected get to succeed");
    expect(res.data.record.order_count).toBe(2);
  });

  it("rejects a write that targets a computed (read-only) column", async () => {
    const res = await updateRecord(
      accountRegistry,
      "account",
      "a1",
      { order_count: 999 },
      { gateway: accountGateway(), actor: accountWriter, now: fixedNow(T0) }
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    if (!res.ok) {
      expect(res.error.code).toBe("admin-shell.VALIDATION_FAILED");
      expect(res.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ column: "order_count", message: "is not editable" })])
      );
    }
  });

  it("does not treat a computed column as a search/filter target", async () => {
    // A filter on the computed column is dropped (not a known real column), so the
    // full result set comes back rather than an injection-prone WHERE clause.
    const res = await listRecords(
      accountRegistry,
      "account",
      { filters: { order_count: 2 } },
      { gateway: accountGateway(), actor: accountWriter }
    );
    if (!res.ok) throw new Error("expected list to succeed");
    expect(res.data.rows.length).toBe(2);
  });

  it("a resource without computed columns is unaffected", async () => {
    const gateway = createMemoryTableGateway({ widgets: [{ id: "w1", name: "A" }] });
    const res = await listRecords(registry, "widget", {}, { gateway, actor: writerActor });
    if (!res.ok) throw new Error("expected list to succeed");
    expect(res.data.rows[0]).not.toHaveProperty("order_count");
  });
});

// A resource that declares a computed column AND lists it as searchable. The
// search box must then match the computed value (e.g. the related owner's email)
// via LIKE against the column's trusted SQL expression — not just real columns.
const teamDef: ResourceDefinition = {
  name: "team",
  table: "teams",
  primaryKey: "id",
  columns: [
    { name: "id", type: "string" },
    { name: "name", type: "string", editable: true },
    { name: "owner_id", type: "string" }
  ],
  computed: [{ name: "owner_email", type: "string", expression: "(SELECT u.email FROM users u WHERE u.id = teams.owner_id LIMIT 1)" }],
  // Mixes a real column (name) with a computed column (owner_email).
  searchable: ["name", "owner_email"],
  permissions: { read: "team.read", write: "team.write" }
};
const teamRegistry = createResourceRegistry([teamDef]);
const teamReader: AdminActor = { id: "u-tr", permissions: ["team.read"] };

function teamGateway() {
  const users = [
    { id: "u1", email: "alice@acme.com" },
    { id: "u2", email: "bob@beta.com" }
  ];
  return createMemoryTableGateway(
    {
      teams: [
        { id: "t1", name: "Alpha", owner_id: "u1" },
        { id: "t2", name: "Bravo", owner_id: "u2" }
      ]
    },
    { owner_email: (row) => users.find((u) => u.id === row.owner_id)?.email ?? null }
  );
}

describe("admin-shell: searchable computed columns", () => {
  it("matches a computed column's value via the search box", async () => {
    const res = await listRecords(teamRegistry, "team", { search: "acme" }, { gateway: teamGateway(), actor: teamReader });
    if (!res.ok) throw new Error("expected list to succeed");
    expect(res.data.rows.map((r) => r.id)).toEqual(["t1"]);
    // The computed column is still projected on the matched row.
    expect(res.data.rows[0].owner_email).toBe("alice@acme.com");
  });

  it("still matches the real searchable column", async () => {
    const res = await listRecords(teamRegistry, "team", { search: "bravo" }, { gateway: teamGateway(), actor: teamReader });
    if (!res.ok) throw new Error("expected list to succeed");
    expect(res.data.rows.map((r) => r.id)).toEqual(["t2"]);
  });

  it("returns no rows when neither the real nor the computed column matches", async () => {
    const res = await listRecords(teamRegistry, "team", { search: "nomatch" }, { gateway: teamGateway(), actor: teamReader });
    if (!res.ok) throw new Error("expected list to succeed");
    expect(res.data.rows.length).toBe(0);
  });
});
