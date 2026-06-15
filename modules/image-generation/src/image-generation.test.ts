import { describe, it, expect } from "vitest";
import {
  generateImage,
  editImage,
  listImages,
  getImage,
  deleteImage,
  createMemoryImageStore,
  createMemoryObjectStorage,
  createMemoryImageProvider,
  resolveProviderOrder,
  generateWithFallback,
  ImageProviderError,
} from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

// generateImage's success data is a union (skip vs full); cast to the full shape.
type GenOk = {
  id: string;
  key: string;
  provider: string;
  mimeType: string;
  bytes: number;
  tokensUsed: number;
  event?: { name: string; correlationId?: string };
};

function deps(overrides: Record<string, unknown> = {}) {
  return {
    providers: { "kie-ai": createMemoryImageProvider({ id: "kie-ai" }) },
    store: createMemoryImageStore(),
    storage: createMemoryObjectStorage(),
    now: fixedNow(T0),
    ...overrides,
  };
}

const validGenerate = { tenantId: "tenant-1", prompt: "a red fox", aspectRatio: "1:1" as const };

describe("generateImage", () => {
  it("generates, stores bytes under a tenant key, persists a record, emits image.generated", async () => {
    const d = deps();
    const res = await generateImage(validGenerate, { ...d, correlationId: "corr-gen" });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const data = res.data as GenOk;
    expect(res.status).toBe(201);
    expect(data.provider).toBe("kie-ai");
    expect(data.key).toMatch(/^tenant-1\//);
    expect((d.storage as ReturnType<typeof createMemoryObjectStorage>).has(data.key)).toBe(true);
    expect(data.event?.name).toBe("image.generated");
    expect(data.event?.correlationId).toBe("corr-gen");
    expect(res.meta.source).toBe("image-generation");

    const listed = await d.store.list({ tenantId: "tenant-1" });
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(data.id);
  });

  it("rejects invalid input with a namespaced 400", async () => {
    const res = await generateImage({ tenantId: "t" }, deps());
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.error.code).toBe("image-generation.INVALID_GENERATE_INPUT");
    }
  });

  it("falls back to the next provider when the default fails with a retryable error", async () => {
    const failing = createMemoryImageProvider({
      id: "kie-ai",
      fail: () => {
        throw new ImageProviderError("upstream down", 503);
      },
    });
    const res = await generateImage(validGenerate, {
      ...deps(),
      providers: { "kie-ai": failing, gemini: createMemoryImageProvider({ id: "gemini" }) },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.data as GenOk).provider).toBe("gemini");
  });

  it("returns the provider error status when no provider is configured", async () => {
    const res = await generateImage(validGenerate, { ...deps(), providers: {} });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(503);
  });
});

describe("listImages / getImage", () => {
  it("lists only the tenant's active images", async () => {
    const d = deps();
    await generateImage({ ...validGenerate, tenantId: "tenant-1" }, d);
    await generateImage({ ...validGenerate, tenantId: "tenant-2" }, d);

    const res = await listImages({ tenantId: "tenant-1" }, { store: d.store });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.count).toBe(1);
      expect(res.data.images[0].tenantId).toBe("tenant-1");
    }
  });

  it("getImage returns 404 across tenants", async () => {
    const d = deps();
    const gen = await generateImage(validGenerate, d);
    if (!gen.ok) throw new Error("gen failed");
    const res = await getImage({ tenantId: "other", imageId: (gen.data as GenOk).id }, { store: d.store });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });
});

describe("deleteImage", () => {
  it("removes the object and soft-deletes the record for the owner", async () => {
    const d = deps();
    const gen = await generateImage(validGenerate, d);
    if (!gen.ok) throw new Error("gen failed");
    const key = (gen.data as GenOk).key;
    expect((d.storage as ReturnType<typeof createMemoryObjectStorage>).has(key)).toBe(true);

    const res = await deleteImage({ tenantId: "tenant-1", imageId: (gen.data as GenOk).id }, { store: d.store, storage: d.storage, now: fixedNow(T0) });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.event?.name).toBe("image.deleted");

    expect((d.storage as ReturnType<typeof createMemoryObjectStorage>).has(key)).toBe(false);
    expect(await d.store.list({ tenantId: "tenant-1", status: "active" })).toHaveLength(0);
  });

  it("refuses to delete another tenant's image", async () => {
    const d = deps();
    const gen = await generateImage(validGenerate, d);
    if (!gen.ok) throw new Error("gen failed");
    const res = await deleteImage({ tenantId: "intruder", imageId: (gen.data as GenOk).id }, { store: d.store, storage: d.storage });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });
});

describe("editImage", () => {
  it("edits a source image into a new record + emits image.edited", async () => {
    const d = deps();
    const gen = await generateImage(validGenerate, d);
    if (!gen.ok) throw new Error("gen failed");

    const res = await editImage(
      { tenantId: "tenant-1", sourceImageId: (gen.data as GenOk).id, prompt: "make it blue" },
      { ...d, correlationId: "corr-edit" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.event?.name).toBe("image.edited");
      expect(res.data.id).not.toBe(gen.data.id);
    }
    expect(await d.store.list({ tenantId: "tenant-1" })).toHaveLength(2);
  });

  it("returns 404 when the source image is missing", async () => {
    const res = await editImage({ tenantId: "tenant-1", sourceImageId: "nope", prompt: "x" }, deps());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });
});

describe("service: resolveProviderOrder", () => {
  it("dedupes and filters to wired providers, honoring an override first", () => {
    const providers = { "kie-ai": createMemoryImageProvider({ id: "kie-ai" }), gemini: createMemoryImageProvider({ id: "gemini" }) };
    const order = resolveProviderOrder(providers, { defaultProvider: "kie-ai", fallbackOrder: ["kie-ai", "gemini", "gpt-image"] }, "gemini");
    expect(order).toEqual(["gemini", "kie-ai"]);
  });

  it("generateWithFallback throws 503 when nothing is wired", async () => {
    await expect(
      generateWithFallback({}, { defaultProvider: "kie-ai", fallbackOrder: [] }, { prompt: "x", aspectRatio: "1:1" }),
    ).rejects.toBeInstanceOf(ImageProviderError);
  });
});
