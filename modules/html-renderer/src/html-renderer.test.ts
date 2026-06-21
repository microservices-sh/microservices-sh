import { describe, expect, it } from "vitest";
import { createHtmlRendererMemoryStore } from "./adapters/memory";
import {
  createHtmlRendererService,
  createSequentialHtmlRendererIdFactory,
  createSequentialHtmlRendererSlugFactory
} from "./service";
import type { ModuleResult, TenantContext } from "./types";

function service() {
  return createHtmlRendererService({
    store: createHtmlRendererMemoryStore(),
    createId: createSequentialHtmlRendererIdFactory(),
    createSlug: createSequentialHtmlRendererSlugFactory(),
    config: { enabled: true, defaultTtlSeconds: 3600, minTtlSeconds: 60, maxTtlSeconds: 86400, maxHtmlBytes: 10000 }
  });
}

function unwrap<T>(result: ModuleResult<T>): T {
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Expected ok result");
  return result.data;
}

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-01-01T00:00:00.000Z"
};

describe("html-renderer service", () => {
  it("creates render documents with validated slugs, TTL, and assets", async () => {
    const renderer = service();
    const document = unwrap(
      await renderer.createHtmlRender(ctx, {
        slug: "landing-preview",
        html: "<main>Hello</main>",
        ttlSeconds: 120,
        assets: [{ path: "style.css", mimeType: "text/css", sizeBytes: 42 }]
      })
    );

    expect(document.slug).toBe("landing-preview");
    expect(document.expiresAt).toBe("2026-01-01T00:02:00.000Z");
    expect(document.assets[0]?.path).toBe("style.css");

    const duplicate = await renderer.createHtmlRender(ctx, { slug: "landing-preview", html: "<main>Again</main>" });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error?.code).toBe("slug_taken");
  });

  it("rejects reserved slugs, invalid assets, short TTLs, and oversized HTML", async () => {
    const renderer = service();
    expect((await renderer.createHtmlRender(ctx, { slug: "api", html: "<main />" })).error?.code).toBe("slug_invalid");
    expect((await renderer.createHtmlRender(ctx, { html: "<main />", ttlSeconds: 30 })).error?.code).toBe("ttl_too_short");
    expect((await renderer.createHtmlRender(ctx, { html: "<main />", assets: [{ path: "../x.css", mimeType: "text/css", sizeBytes: 1 }] })).error?.code).toBe("asset_path_invalid");
    expect((await renderer.createHtmlRender(ctx, { html: "x".repeat(10001) })).error?.code).toBe("html_too_large");
  });

  it("resolves active documents, blocks expired documents, and soft deletes", async () => {
    const renderer = service();
    const document = unwrap(await renderer.createHtmlRender(ctx, { html: "<main>Preview</main>", ttlSeconds: 60 }));
    expect(document.slug).toBe("h0000001");

    const resolved = unwrap(await renderer.resolveHtmlRender(ctx, { slug: document.slug }));
    expect(resolved.html).toContain("Preview");

    const expired = await renderer.resolveHtmlRender({ ...ctx, now: "2026-01-01T00:01:00.000Z" }, { slug: document.slug });
    expect(expired.ok).toBe(false);
    expect(expired.error?.code).toBe("document_expired");

    const persistent = unwrap(await renderer.createHtmlRender(ctx, { html: "<main>Persistent</main>", slug: "persistent", ttlSeconds: 0 }));
    unwrap(await renderer.deleteHtmlRender(ctx, { slug: persistent.slug }));
    const deleted = await renderer.resolveHtmlRender(ctx, { slug: persistent.slug });
    expect(deleted.ok).toBe(false);
    expect(deleted.error?.code).toBe("document_deleted");
  });
});
