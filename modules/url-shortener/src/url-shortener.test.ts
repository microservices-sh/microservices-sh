import { describe, expect, it } from "vitest";
import { createUrlShortenerMemoryStore } from "./adapters/memory";
import {
  createSequentialUrlShortenerCodeFactory,
  createSequentialUrlShortenerIdFactory,
  createUrlShortenerService
} from "./service";
import type { ModuleResult, TenantContext } from "./types";

function service() {
  return createUrlShortenerService({
    store: createUrlShortenerMemoryStore(),
    createId: createSequentialUrlShortenerIdFactory(),
    createCode: createSequentialUrlShortenerCodeFactory(),
    config: { enabled: true, defaultCodeLength: 6, maxExpiryDays: 30 }
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

describe("url-shortener service", () => {
  it("creates custom aliases with expiry and rejects duplicates or reserved/private values", async () => {
    const links = service();
    const link = unwrap(await links.createShortLink(ctx, { url: "example.com/docs", customAlias: "docs", expiresInDays: 7 }));
    expect(link.originalUrl).toBe("https://example.com/docs");
    expect(link.expiresAt).toBe("2026-01-08T00:00:00.000Z");
    expect(link.customAlias).toBe(true);

    const duplicate = await links.createShortLink(ctx, { url: "https://example.com/other", customAlias: "docs" });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error?.code).toBe("alias_taken");

    const reserved = await links.createShortLink(ctx, { url: "https://example.com", customAlias: "api" });
    expect(reserved.ok).toBe(false);
    expect(reserved.error?.code).toBe("alias_reserved");

    const privateUrl = await links.createShortLink(ctx, { url: "http://localhost:5173", customAlias: "local-dev" });
    expect(privateUrl.ok).toBe(false);
    expect(privateUrl.error?.code).toBe("url_private_not_allowed");
  });

  it("resolves links, records click analytics, and reports stats", async () => {
    const links = service();
    const link = unwrap(await links.createShortLink(ctx, { url: "https://example.com/pricing" }));
    expect(link.code).toBe("u00001");

    const resolution = unwrap(
      await links.resolveShortLink(ctx, {
        code: link.code,
        analytics: {
          country: "US",
          deviceType: "mobile",
          browser: "Safari",
          os: "iOS",
          referrer: "example.org"
        }
      })
    );
    expect(resolution.originalUrl).toBe("https://example.com/pricing");

    const stats = unwrap(await links.getShortLinkStats(ctx, { code: link.code, days: 30 }));
    expect(stats.totalClicks).toBe(1);
    expect(stats.uniqueCountries).toBe(1);
    expect(stats.clicksByDevice[0]).toMatchObject({ name: "mobile", count: 1, percentage: 100 });
    expect(stats.clicksByReferrer[0]?.name).toBe("example.org");

    const recent = unwrap(await links.listRecentLinks(ctx));
    expect(recent[0]?.clicks).toBe(1);
  });

  it("blocks disabled and expired links", async () => {
    const links = service();
    const link = unwrap(await links.createShortLink(ctx, { url: "https://example.com/launch", customAlias: "launch", expiresInDays: 1 }));

    const expired = await links.resolveShortLink({ ...ctx, now: "2026-01-02T00:00:00.000Z" }, { code: link.code });
    expect(expired.ok).toBe(false);
    expect(expired.error?.code).toBe("link_expired");

    const activeLink = unwrap(await links.createShortLink(ctx, { url: "https://example.com/active", customAlias: "active" }));
    unwrap(await links.deactivateShortLink(ctx, { code: activeLink.code }));
    const disabled = await links.resolveShortLink(ctx, { code: activeLink.code });
    expect(disabled.ok).toBe(false);
    expect(disabled.error?.code).toBe("link_disabled");
  });
});
