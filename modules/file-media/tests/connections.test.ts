import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { createUploadTicket } from "../src/use-cases/create-upload-ticket";
import { completeUpload } from "../src/use-cases/complete-upload";
import { listFiles } from "../src/use-cases/list-files";
import { createMemoryMediaStore } from "../src/adapters/memory-media-store";
import { createMemoryObjectStorage } from "../src/adapters/memory-object-storage";

const fileMediaManifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const authManifest = JSON.parse(readFileSync(new URL("../../auth/module.json", import.meta.url), "utf8"));

const validTicketInput = { tenantId: "tenant-1", originalName: "photo.png", contentType: "image/png" };
const deps = () => ({ mediaStore: createMemoryMediaStore(), storage: createMemoryObjectStorage() });

describe("file-media connections manifest", () => {
  it("composes standalone (no requires, empty rpc.calls)", () => {
    const r = compose([
      { id: "file-media", grantedScopes: [], connections: fileMediaManifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("file-media");
  });

  it("composes alongside its optional auth dependency", () => {
    const r = compose([
      { id: "auth", grantedScopes: [], connections: authManifest.connections },
      { id: "file-media", grantedScopes: [], connections: fileMediaManifest.connections },
    ]);
    expect(r.ok).toBe(true);
  });

  it("declares typed hook points", () => {
    expect(fileMediaManifest.connections.hookPoints.beforeUpload.kind).toBe("filter");
    expect(fileMediaManifest.connections.hookPoints.allowContentType.kind).toBe("guard");
    expect(fileMediaManifest.connections.hookPoints.onFileUploaded.kind).toBe("observer");
  });

  it("exposes its rpc surface and makes no cross-module calls", () => {
    const methods = fileMediaManifest.connections.rpc.exposes.map((e: { method: string }) => e.method);
    expect(methods).toContain("createUploadTicket");
    expect(fileMediaManifest.connections.rpc.calls).toEqual([]);
  });
});

describe("createUploadTicket cross-module hooks + meta", () => {
  it("threads the correlationId into meta and the emitted event", async () => {
    const r = await createUploadTicket(validTicketInput, { ...deps(), correlationId: "corr-fm" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.meta.correlationId).toBe("corr-fm");
      expect(r.meta.source).toBe("file-media");
      expect(r.data.event?.correlationId).toBe("corr-fm");
    }
  });

  it("a filter hook mutates the input before the key is reserved", async () => {
    const filter = {
      kind: "filter" as const,
      order: 10,
      fn: async (i: any) => ({ ...i, originalName: "renamed.png" }),
    };
    const r = await createUploadTicket(validTicketInput, { ...deps(), beforeUploadHooks: [filter] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(String(r.data.key)).toContain("renamed.png");
  });

  it("a guard hook can veto the upload", async () => {
    const guard = {
      kind: "guard" as const,
      order: 10,
      fn: async () => ({ ok: false as const, status: 403, error: { code: "file-media.BLOCKED", message: "blocked" } }),
    };
    const r = await createUploadTicket(validTicketInput, { ...deps(), beforeUploadHooks: [guard] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("file-media.BLOCKED");
      expect(r.status).toBe(403);
    }
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await createUploadTicket({}, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("file-media.INVALID_UPLOAD_INPUT");
    expect(r.meta.source).toBe("file-media");
  });

  it("completeUpload emits media.uploaded carrying the correlationId", async () => {
    const d = deps();
    const ticket = await createUploadTicket(validTicketInput, { ...d, correlationId: "corr-up" });
    expect(ticket.ok).toBe(true);
    if (!ticket.ok) return;
    const key = ticket.data.key as string;
    d.storage.setSize(key, { size: 64, contentType: "image/png" });

    const r = await completeUpload(
      { ticketId: ticket.data.ticketId, tenantId: "tenant-1" },
      { ...d, correlationId: "corr-up" }
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.event?.name).toBe("media.uploaded");
      expect(r.data.event?.correlationId).toBe("corr-up");
      expect(r.meta.correlationId).toBe("corr-up");
    }
  });

  it("filters files by ownerId within a tenant", async () => {
    const d = deps();
    for (const ownerId of ["customer-a", "customer-b"]) {
      const ticket = await createUploadTicket({ ...validTicketInput, ownerId }, d);
      expect(ticket.ok).toBe(true);
      if (!ticket.ok) continue;
      d.storage.setSize(ticket.data.key as string, { size: 64, contentType: "image/png" });
      const completed = await completeUpload({ ticketId: ticket.data.ticketId, tenantId: "tenant-1" }, d);
      expect(completed.ok).toBe(true);
    }

    const scoped = await listFiles({ tenantId: "tenant-1", ownerId: "customer-a" }, { mediaStore: d.mediaStore });
    expect(scoped.ok).toBe(true);
    if (scoped.ok) {
      expect(scoped.data.count).toBe(1);
      expect(scoped.data.files[0].ownerId).toBe("customer-a");
    }

    const tenantWide = await listFiles({ tenantId: "tenant-1" }, { mediaStore: d.mediaStore });
    expect(tenantWide.ok).toBe(true);
    if (tenantWide.ok) expect(tenantWide.data.count).toBe(2);
  });
});
