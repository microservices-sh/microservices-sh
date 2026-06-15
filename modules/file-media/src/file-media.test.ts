import { describe, it, expect } from "vitest";
import {
  createUploadTicket,
  completeUpload,
  expireStaleTickets,
  buildObjectKey,
  createMemoryMediaStore,
  createMemoryObjectStorage
} from "./index";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

describe("file-media: createUploadTicket content-type allowlist", () => {
  it("rejects a disallowed content-type with 415", async () => {
    const mediaStore = createMemoryMediaStore();
    const res = await createUploadTicket(
      { tenantId: "tenant-1", originalName: "evil.exe", contentType: "application/x-msdownload" },
      { mediaStore, now: fixedNow(T0) }
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(415);
    if (!res.ok) expect(res.error.code).toBe("file-media.UNSUPPORTED_MEDIA_TYPE");
  });

  it("accepts an allowed content-type and returns a tenant-prefixed key", async () => {
    const mediaStore = createMemoryMediaStore();
    const res = await createUploadTicket(
      { tenantId: "tenant-1", originalName: "photo.png", contentType: "image/png" },
      { mediaStore, now: fixedNow(T0) }
    );
    expect(res.ok).toBe(true);
    expect(res.status).toBe(201);
    if (res.ok) expect(String((res.data as { key?: string }).key)).toMatch(/^tenant-1\//);
  });
});

describe("file-media: completeUpload storage check", () => {
  it("fails with 422 when the object isn't in storage", async () => {
    const mediaStore = createMemoryMediaStore();
    const storage = createMemoryObjectStorage();

    const ticketRes = await createUploadTicket(
      { tenantId: "tenant-1", originalName: "photo.png", contentType: "image/png" },
      { mediaStore, now: fixedNow(T0) }
    );
    const ticketId = ticketRes.ok ? (ticketRes.data as { ticketId: string }).ticketId : "";

    // Intentionally do NOT upload bytes to storage.
    const res = await completeUpload(
      { ticketId, tenantId: "tenant-1" },
      { mediaStore, storage, now: fixedNow(T0 + 1000) }
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(422);
    if (!res.ok) expect(res.error.code).toBe("file-media.OBJECT_NOT_FOUND");
  });

  it("completes when the bytes are present at the ticket key", async () => {
    const mediaStore = createMemoryMediaStore();
    const storage = createMemoryObjectStorage();

    const ticketRes = await createUploadTicket(
      { tenantId: "tenant-1", originalName: "photo.png", contentType: "image/png" },
      { mediaStore, now: fixedNow(T0) }
    );
    const ticketId = ticketRes.ok ? (ticketRes.data as { ticketId: string }).ticketId : "";
    const key = ticketRes.ok ? (ticketRes.data as { key: string }).key : "";

    storage.setSize(key, { size: 1024, contentType: "image/png" });

    const res = await completeUpload(
      { ticketId, tenantId: "tenant-1" },
      { mediaStore, storage, now: fixedNow(T0 + 1000) }
    );
    expect(res.ok).toBe(true);
    expect(res.status).toBe(201);
    if (res.ok) expect((res.data as { bytes?: number }).bytes).toBe(1024);
  });
});

describe("file-media: buildObjectKey tenant prefixing", () => {
  it("prefixes the key with the tenant id", () => {
    const key = buildObjectKey("acme", "upl_123", "Report Final.PDF");
    expect(key.startsWith("acme/")).toBe(true);
    expect(key).toBe("acme/upl_123/Report_Final.PDF");
  });

  it("throws when tenantId is empty", () => {
    expect(() => buildObjectKey("", "upl_1", "f.png")).toThrow();
  });
});

describe("file-media: expireStaleTickets", () => {
  it("removes an orphan object and marks the ticket expired", async () => {
    const mediaStore = createMemoryMediaStore();
    const storage = createMemoryObjectStorage();

    const ticketRes = await createUploadTicket(
      { tenantId: "tenant-1", originalName: "orphan.png", contentType: "image/png" },
      { mediaStore, now: fixedNow(T0) }
    );
    const ticketId = ticketRes.ok ? (ticketRes.data as { ticketId: string }).ticketId : "";
    const key = ticketRes.ok ? (ticketRes.data as { key: string }).key : "";

    // Bytes were uploaded but the upload was never completed (orphan).
    storage.setSize(key, { size: 512, contentType: "image/png" });
    expect(await storage.head(key)).not.toBeNull();

    // Run cleanup well after the ticket TTL (default 900_000 ms).
    const res = await expireStaleTickets({ mediaStore, storage, now: fixedNow(T0 + 1_000_000) });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.cleaned).toBe(1);

    // Orphan object removed.
    expect(await storage.head(key)).toBeNull();
    // Ticket marked expired.
    const ticket = await mediaStore.getTicket(ticketId);
    expect(ticket?.status).toBe("expired");
  });
});
