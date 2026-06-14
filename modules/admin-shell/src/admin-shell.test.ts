import { describe, it, expect } from "vitest";
import {
  createResourceRegistry,
  listRecords,
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
    expect(res.error?.code).toBe("FORBIDDEN");
  });

  it("returns rows for an actor with read permission", async () => {
    const gateway = createMemoryTableGateway({ widgets: [{ id: "w1", name: "A" }] });
    const res = await listRecords(registry, "widget", {}, { gateway, actor: readerActor });
    expect(res.ok).toBe(true);
    expect(res.data?.rows.length).toBe(1);
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
    expect(del.data?.mode).toBe("soft");

    // Row still physically present (soft delete), but flagged.
    const raw = await gateway.get(widgetDef, "w1");
    expect(raw).not.toBeNull();
    expect(raw?.deleted_at).toBe("1");

    // Default list (read-only actor) excludes the soft-deleted row.
    const list = await listRecords(registry, "widget", {}, { gateway, actor: writerActor });
    const ids = list.data!.rows.map((r) => r.id);
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
    expect(res.error?.code).toBe("VALIDATION_FAILED");
    expect(res.error?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ column: "createdBy", message: "is not editable" })])
    );
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
