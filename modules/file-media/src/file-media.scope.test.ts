import { describe, it, expect } from "vitest";
import { authContext } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import {
  createUploadTicket,
  completeUpload,
  createMemoryMediaStore,
  createMemoryObjectStorage,
  createUploadTicketScoped,
  listFilesScoped,
  getFileScoped,
  deleteFileScoped
} from "./index";

// plans/33 — the enforced authorization boundary, proven for file-media. Two
// tenants share one store + object bucket (one deployment); an actor scoped to
// org A must never list, read, mutate, or write into org B's files.
const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

async function seedFile(
  mediaStore: ReturnType<typeof createMemoryMediaStore>,
  storage: ReturnType<typeof createMemoryObjectStorage>,
  tenantId: string
) {
  const ticket = await createUploadTicket(
    { tenantId, originalName: "photo.png", contentType: "image/png" },
    { mediaStore, now: fixedNow(T0) }
  );
  if (!ticket.ok) throw new Error("seed ticket failed");
  const key = (ticket.data as { key: string }).key;
  const ticketId = (ticket.data as { ticketId: string }).ticketId;
  await storage.put(key, "bytes", { contentType: "image/png" });
  const done = await completeUpload({ ticketId, tenantId }, { mediaStore, storage, now: fixedNow(T0 + 1000) });
  if (!done.ok) throw new Error("seed complete failed");
  return (done.data as { id: string }).id;
}

describe("file-media: enforced tenant boundary (cross-tenant leak test)", () => {
  it("an actor scoped to org A can never list, read, mutate, or mis-key org B's files", async () => {
    const mediaStore = createMemoryMediaStore();
    const storage = createMemoryObjectStorage();
    const deps = { mediaStore, storage, now: fixedNow(T0 + 2000) };
    const ctxA = authContext({ orgId: "tenant-1", actorId: "user-a" });
    const ctxB = authContext({ orgId: "tenant-2", actorId: "user-b" });

    const fileA = await seedFile(mediaStore, storage, "tenant-1");
    const fileB = await seedFile(mediaStore, storage, "tenant-2");

    // LIST as A returns only A's files — even with a forged tenantId on the input.
    const listed = await listFilesScoped(ctxA, { tenantId: "tenant-2" }, { mediaStore });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.count).toBe(1);
      expect(listed.data.files.every((f) => f.tenantId === "tenant-1")).toBe(true);
    }

    // GET: A's file resolves; B's id is not-found (no existence disclosure).
    const ownGet = await getFileScoped(ctxA, fileA, { mediaStore });
    expect(ownGet.ok).toBe(true);
    const foreignGet = await getFileScoped(ctxA, fileB, { mediaStore });
    expect(foreignGet.ok).toBe(false);
    expect(foreignGet.status).toBe(404);

    // DELETE: A deleting B's file is refused (the forced tenant fails the row guard).
    const foreignDelete = await deleteFileScoped(ctxA, { fileId: fileB }, deps);
    expect(foreignDelete.ok).toBe(false);
    expect(foreignDelete.status).toBe(404);
    // B's file is untouched: still active.
    const bStill = await getFileScoped(ctxB, fileB, { mediaStore });
    expect(bStill.ok).toBe(true);
    if (bStill.ok) expect(bStill.data.file.status).toBe("active");

    // WRITE: A requesting an upload while forging tenant-2 still gets a tenant-1
    // key — bytes can never be written under another tenant's prefix.
    const ticket = await createUploadTicketScoped(
      ctxA,
      { tenantId: "tenant-2", originalName: "x.png", contentType: "image/png" },
      { mediaStore }
    );
    expect(ticket.ok).toBe(true);
    if (ticket.ok) expect(String((ticket.data as { key: string }).key)).toMatch(/^tenant-1\//);

    // A call lacking an org scope is refused (403).
    const noScope = await listFilesScoped(
      { orgId: "", actorId: "x", roles: [] } as unknown as AuthContext,
      {},
      { mediaStore }
    );
    expect(noScope.ok).toBe(false);
    expect(noScope.status).toBe(403);
  });
});
