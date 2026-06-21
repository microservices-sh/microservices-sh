import { describe, expect, it } from "vitest";
import { createContentCmsMemoryStore } from "./adapters/memory";
import {
  createContentCmsService,
  createSequentialContentCmsIdFactory
} from "./service";
import type { TenantContext } from "./types";

function service() {
  return createContentCmsService({
    store: createContentCmsMemoryStore(),
    createId: createSequentialContentCmsIdFactory()
  });
}

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-06-21T00:00:00.000Z"
};

describe("content-cms", () => {
  it("creates content types, fields, and initial entry snapshots", async () => {
    const cms = service();
    const blogType = await cms.createContentType(ctx, {
      name: "Blog Post",
      apiId: "blog_post",
      displayField: "title"
    });
    expect(blogType.ok).toBe(true);

    const titleField = await cms.addContentField(ctx, {
      contentTypeId: blogType.data!.id,
      name: "Title",
      apiId: "title",
      type: "text",
      isRequired: true
    });
    expect(titleField.ok).toBe(true);

    const missingTitle = await cms.createContentEntry(ctx, {
      contentTypeId: blogType.data!.id,
      data: { body: "No title." }
    });
    expect(missingTitle.ok).toBe(false);
    expect(missingTitle.error?.code).toBe("required_fields_missing");

    const entry = await cms.createContentEntry(ctx, {
      contentTypeId: blogType.data!.id,
      data: { title: "First post", body: "Hello" },
      changeDescription: "Initial draft"
    });
    expect(entry.ok).toBe(true);
    expect(entry.data?.entry.status).toBe("draft");
    expect(entry.data?.version.version).toBe(1);
    expect(entry.data?.data.title).toBe("First post");
  });

  it("versions, publishes, and localizes entries", async () => {
    const cms = service();
    const locale = await cms.createLocale(ctx, {
      code: "en-US",
      name: "English (US)",
      isDefault: true
    });
    expect(locale.ok).toBe(true);

    const type = await cms.createContentType(ctx, { name: "Page", apiId: "page" });
    const title = await cms.addContentField(ctx, {
      contentTypeId: type.data!.id,
      name: "Title",
      apiId: "title",
      type: "text",
      isRequired: true
    });
    expect(title.ok).toBe(true);

    const first = await cms.createContentEntry(ctx, {
      contentTypeId: type.data!.id,
      data: { title: "Home", body: "Draft" }
    });
    const second = await cms.saveEntryVersion(ctx, {
      entryId: first.data!.entry.id,
      data: { title: "Home", body: "Ready" },
      changeDescription: "Prepared for publish"
    });
    expect(second.data?.version.version).toBe(2);

    const published = await cms.publishEntry(ctx, {
      entryId: first.data!.entry.id,
      version: 2
    });
    expect(published.ok).toBe(true);
    expect(published.data?.entry.status).toBe("published");
    expect(published.data?.entry.publishedVersion).toBe(2);

    const localization = await cms.upsertLocalization(ctx, {
      entryVersionId: published.data!.version.id,
      locale: "en-us",
      data: { title: "Localized Home" },
      status: "ready"
    });
    expect(localization.ok).toBe(true);
    expect(localization.data?.locale).toBe("en-US");

    const localizedSnapshot = await cms.getEntrySnapshot(ctx, {
      entryId: first.data!.entry.id,
      locale: "en-US"
    });
    expect(localizedSnapshot.ok).toBe(true);
    expect(localizedSnapshot.data?.data.title).toBe("Localized Home");
    expect(localizedSnapshot.data?.data.body).toBe("Ready");
  });

  it("tracks default locales and media metadata", async () => {
    const cms = service();
    const english = await cms.createLocale(ctx, { code: "en-US", name: "English", isDefault: true });
    const french = await cms.createLocale(ctx, { code: "fr-FR", name: "French", nativeName: "Francais", isDefault: true });
    expect(english.ok).toBe(true);
    expect(french.ok).toBe(true);

    const locales = await cms.listLocales(ctx, true);
    expect(locales.data?.filter((locale) => locale.isDefault)).toHaveLength(1);
    expect(locales.data?.find((locale) => locale.code === "fr-FR")?.isDefault).toBe(true);

    const duplicateLocale = await cms.createLocale(ctx, { code: "fr-fr", name: "Duplicate French" });
    expect(duplicateLocale.ok).toBe(false);
    expect(duplicateLocale.error?.code).toBe("locale_exists");

    const media = await cms.createMediaAsset(ctx, {
      filename: "hero.webp",
      mimeType: "image/webp",
      sizeBytes: 4096,
      storageKey: "images/hero.webp",
      publicUrl: "https://cdn.example.test/images/hero.webp",
      tags: ["hero", "homepage"]
    });
    expect(media.ok).toBe(true);
    expect(media.data?.originalFilename).toBe("hero.webp");
    expect(media.data?.tags).toEqual(["hero", "homepage"]);
  });
});
