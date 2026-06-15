import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { createResourceRegistry } from "../src/registry";
import { createMemoryTableGateway } from "../src/adapters/memory-table-gateway";
import { createRecord } from "../src/use-cases/create-record";
import type { AdminActor, ResourceDefinition } from "../src/types";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

const widgetDef: ResourceDefinition = {
  name: "widget",
  table: "widgets",
  primaryKey: "id",
  columns: [
    { name: "id", type: "string" },
    { name: "name", type: "string", editable: true }
  ],
  permissions: { read: "widget.read", write: "widget.write" }
};
const registry = createResourceRegistry([widgetDef]);
const writer: AdminActor = { id: "u-writer", permissions: ["widget.read", "widget.write"] };

describe("admin-shell connections manifest", () => {
  it("composes standalone (no requires, no rpc.calls)", () => {
    const r = compose([
      { id: "admin-shell", grantedScopes: [], connections: manifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("admin-shell");
  });

  it("declares typed hook points", () => {
    expect(manifest.connections.hookPoints.beforeWrite.kind).toBe("filter");
    expect(manifest.connections.hookPoints.onAdminAction.kind).toBe("observer");
  });

  it("emits its lifecycle events and consumes none", () => {
    expect(manifest.connections.events.emits).toContain("admin.record_created");
    expect(manifest.connections.events.consumes).toEqual([]);
  });
});

describe("admin-shell meta + namespaced errors", () => {
  it("threads correlationId through meta and the emitted event", async () => {
    const gateway = createMemoryTableGateway({ widgets: [] });
    const r = await createRecord(registry, "widget", { name: "A" }, { gateway, actor: writer, correlationId: "corr-x" });
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    if (r.ok) expect(r.data.event?.correlationId).toBe("corr-x");
  });

  it("validation errors are namespaced and carry meta", async () => {
    const gateway = createMemoryTableGateway({ widgets: [] });
    const r = await createRecord(registry, "nope", { name: "A" }, { gateway, actor: writer });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("admin-shell.RESOURCE_NOT_FOUND");
    expect(r.meta.source).toBe("admin-shell");
  });
});
