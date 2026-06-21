import type { ContentCmsStore } from "../ports";
import type {
  AddContentFieldInput,
  ArchiveEntryInput,
  CmsLocale,
  CmsMediaAsset,
  ContentCmsConfig,
  ContentCmsIdFactory,
  ContentCmsIdPrefix,
  ContentEntry,
  ContentEntryLocalization,
  ContentEntrySnapshot,
  ContentEntryVersion,
  ContentFieldDefinition,
  ContentFieldType,
  ContentStatus,
  ContentTypeDefinition,
  CreateContentEntryInput,
  CreateContentTypeInput,
  CreateLocaleInput,
  CreateMediaAssetInput,
  GetEntrySnapshotInput,
  LocaleDirection,
  LocalizationStatus,
  ModuleResult,
  PublishEntryInput,
  SaveEntryVersionInput,
  TenantContext,
  UpsertLocalizationInput
} from "../types";

const API_ID_RE = /^[a-z][a-z0-9_]{0,63}$/;
const LOCALE_RE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;
const FIELD_TYPES = new Set<ContentFieldType>([
  "text",
  "richtext",
  "number",
  "boolean",
  "date",
  "media",
  "reference",
  "json",
  "slug",
  "enum",
  "color",
  "email",
  "url"
]);
const LOCALIZATION_STATUSES = new Set<LocalizationStatus>(["draft", "review", "ready"]);

export interface ContentCmsServiceDeps {
  store: ContentCmsStore;
  createId?: ContentCmsIdFactory;
  config?: ContentCmsConfig;
}

export interface ContentCmsService {
  createContentType(ctx: TenantContext, input: CreateContentTypeInput): Promise<ModuleResult<ContentTypeDefinition>>;
  addContentField(ctx: TenantContext, input: AddContentFieldInput): Promise<ModuleResult<ContentFieldDefinition>>;
  listContentTypes(ctx: TenantContext): Promise<ModuleResult<ContentTypeDefinition[]>>;
  createLocale(ctx: TenantContext, input: CreateLocaleInput): Promise<ModuleResult<CmsLocale>>;
  listLocales(ctx: TenantContext, includeDisabled?: boolean): Promise<ModuleResult<CmsLocale[]>>;
  createContentEntry(ctx: TenantContext, input: CreateContentEntryInput): Promise<ModuleResult<ContentEntrySnapshot>>;
  saveEntryVersion(ctx: TenantContext, input: SaveEntryVersionInput): Promise<ModuleResult<ContentEntrySnapshot>>;
  publishEntry(ctx: TenantContext, input: PublishEntryInput): Promise<ModuleResult<ContentEntrySnapshot>>;
  archiveEntry(ctx: TenantContext, input: ArchiveEntryInput): Promise<ModuleResult<ContentEntry>>;
  upsertLocalization(ctx: TenantContext, input: UpsertLocalizationInput): Promise<ModuleResult<ContentEntryLocalization>>;
  createMediaAsset(ctx: TenantContext, input: CreateMediaAssetInput): Promise<ModuleResult<CmsMediaAsset>>;
  listMediaAssets(ctx: TenantContext, limit?: number): Promise<ModuleResult<CmsMediaAsset[]>>;
  getEntrySnapshot(ctx: TenantContext, input: GetEntrySnapshotInput): Promise<ModuleResult<ContentEntrySnapshot>>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function failFrom<T>(result: ModuleResult<unknown>): ModuleResult<T> {
  return fail(result.error?.code ?? "operation_failed", result.error?.message ?? "Operation failed.");
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialContentCmsIdFactory(): ContentCmsIdFactory {
  let sequence = 0;
  return (prefix: ContentCmsIdPrefix) => id(prefix, ++sequence);
}

function defaultId(prefix: ContentCmsIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid ? uuid.replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeApiId(value: string): ModuleResult<string> {
  const apiId = value.trim().toLowerCase();
  if (!API_ID_RE.test(apiId)) return fail("api_id_invalid", "API id must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.");
  return ok(apiId);
}

function normalizeLocaleCode(value: string): ModuleResult<string> {
  const code = value.trim();
  if (!LOCALE_RE.test(code)) return fail("locale_invalid", "Locale code must look like en, en-US, or fr-FR.");
  const [language, region] = code.split("-");
  return ok(region ? `${language.toLowerCase()}-${region.toUpperCase()}` : language.toLowerCase());
}

function ensureObject(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isMissing(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function validateData(fields: ContentFieldDefinition[], data: Record<string, unknown>, enforceRequiredFields: boolean): ModuleResult<Record<string, unknown>> {
  if (!enforceRequiredFields) return ok({ ...data });
  const missing = fields.filter((field) => field.isRequired && !field.isHidden && isMissing(data[field.apiId])).map((field) => field.apiId);
  if (missing.length > 0) return fail("required_fields_missing", `Missing required fields: ${missing.join(", ")}.`);
  return ok({ ...data });
}

async function buildSnapshot(
  store: ContentCmsStore,
  ctx: TenantContext,
  entry: ContentEntry,
  version: ContentEntryVersion,
  localeCode?: string | null
): Promise<ModuleResult<ContentEntrySnapshot>> {
  const contentType = await store.getContentType(ctx.tenantId, entry.contentTypeId);
  if (!contentType) return fail("content_type_not_found", "Content type was not found.");
  const fields = await store.listFields(ctx.tenantId, contentType.id);
  const localization = localeCode ? await store.getLocalization(ctx.tenantId, version.id, localeCode) : null;
  return ok({
    entry,
    contentType,
    fields,
    version,
    data: localization ? { ...version.data, ...localization.data } : { ...version.data },
    localization
  });
}

async function latestVersion(store: ContentCmsStore, tenantId: string, entryId: string): Promise<ContentEntryVersion | null> {
  const versions = await store.listVersionsForEntry(tenantId, entryId);
  return versions[0] ?? null;
}

function publishedOrLatestVersionNumber(entry: ContentEntry, versions: ContentEntryVersion[]): number | null {
  return entry.publishedVersion ?? versions[0]?.version ?? null;
}

export function createContentCmsService(deps: ContentCmsServiceDeps): ContentCmsService {
  const createId = deps.createId ?? defaultId;
  const enforceRequiredFields = deps.config?.enforceRequiredFields ?? true;

  return {
    async createContentType(ctx, input) {
      const name = cleanText(input.name);
      if (!name) return fail("name_required", "Content type name is required.");
      const apiId = normalizeApiId(input.apiId);
      if (!apiId.ok || !apiId.data) return failFrom<ContentTypeDefinition>(apiId);
      if (await deps.store.getContentTypeByApiId(ctx.tenantId, apiId.data)) return fail("content_type_exists", "Content type API id already exists.");
      const timestamp = now(ctx);
      const contentType: ContentTypeDefinition = {
        id: createId("ctyp"),
        tenantId: ctx.tenantId,
        name,
        apiId: apiId.data,
        description: cleanText(input.description),
        icon: cleanText(input.icon),
        isSingleton: input.isSingleton ?? false,
        isSystem: input.isSystem ?? false,
        sortField: cleanText(input.sortField) ?? "createdAt",
        sortOrder: input.sortOrder ?? "desc",
        displayField: cleanText(input.displayField) ?? "title",
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertContentType(contentType);
      return ok(contentType);
    },

    async addContentField(ctx, input) {
      const contentType = await deps.store.getContentType(ctx.tenantId, input.contentTypeId);
      if (!contentType) return fail("content_type_not_found", "Content type was not found.");
      const name = cleanText(input.name);
      if (!name) return fail("name_required", "Content field name is required.");
      const apiId = normalizeApiId(input.apiId);
      if (!apiId.ok || !apiId.data) return failFrom<ContentFieldDefinition>(apiId);
      if (!FIELD_TYPES.has(input.type)) return fail("field_type_invalid", "Content field type is not supported.");
      if (await deps.store.getFieldByApiId(ctx.tenantId, contentType.id, apiId.data)) return fail("field_exists", "Content field API id already exists for this content type.");
      const fields = await deps.store.listFields(ctx.tenantId, contentType.id);
      const timestamp = now(ctx);
      const field: ContentFieldDefinition = {
        id: createId("cfld"),
        tenantId: ctx.tenantId,
        contentTypeId: contentType.id,
        name,
        apiId: apiId.data,
        type: input.type,
        description: cleanText(input.description),
        config: ensureObject(input.config),
        validation: ensureObject(input.validation),
        defaultValue: input.defaultValue ?? null,
        isRequired: input.isRequired ?? Boolean(input.validation?.required),
        isUnique: input.isUnique ?? Boolean(input.validation?.unique),
        isLocalizable: input.isLocalizable ?? false,
        isHidden: input.isHidden ?? false,
        position: input.position ?? fields.length + 1,
        group: cleanText(input.group),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertField(field);
      return ok(field);
    },

    async listContentTypes(ctx) {
      return ok(await deps.store.listContentTypes(ctx.tenantId));
    },

    async createLocale(ctx, input) {
      const code = normalizeLocaleCode(input.code);
      if (!code.ok || !code.data) return failFrom<CmsLocale>(code);
      const name = cleanText(input.name);
      if (!name) return fail("name_required", "Locale name is required.");
      if (await deps.store.getLocaleByCode(ctx.tenantId, code.data)) return fail("locale_exists", "Locale code already exists.");
      const existingLocales = await deps.store.listLocales(ctx.tenantId, true);
      const shouldBeDefault = input.isDefault ?? existingLocales.length === 0;
      if (shouldBeDefault) {
        const existingDefault = await deps.store.getDefaultLocale(ctx.tenantId);
        if (existingDefault) await deps.store.upsertLocale({ ...existingDefault, isDefault: false, updatedAt: now(ctx) });
      }
      const timestamp = now(ctx);
      const direction: LocaleDirection = input.direction ?? "ltr";
      const locale: CmsLocale = {
        id: createId("clng"),
        tenantId: ctx.tenantId,
        code: code.data,
        name,
        nativeName: cleanText(input.nativeName),
        isDefault: shouldBeDefault,
        isEnabled: input.isEnabled ?? true,
        fallbackLocale: cleanText(input.fallbackLocale),
        direction,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertLocale(locale);
      return ok(locale);
    },

    async listLocales(ctx, includeDisabled = false) {
      return ok(await deps.store.listLocales(ctx.tenantId, includeDisabled));
    },

    async createContentEntry(ctx, input) {
      const contentType = await deps.store.getContentType(ctx.tenantId, input.contentTypeId);
      if (!contentType) return fail("content_type_not_found", "Content type was not found.");
      if (contentType.isSingleton) {
        const existing = await deps.store.listEntriesByContentType(ctx.tenantId, contentType.id);
        if (existing.length > 0) return fail("singleton_exists", "Singleton content type already has an entry.");
      }
      const fields = await deps.store.listFields(ctx.tenantId, contentType.id);
      const validated = validateData(fields, input.data, enforceRequiredFields);
      if (!validated.ok || !validated.data) return failFrom<ContentEntrySnapshot>(validated);
      const timestamp = now(ctx);
      const entry: ContentEntry = {
        id: createId("cent"),
        tenantId: ctx.tenantId,
        contentTypeId: contentType.id,
        status: input.status ?? "draft",
        publishedAt: null,
        publishedVersion: null,
        scheduledAt: cleanText(input.scheduledAt),
        createdBy: cleanText(ctx.actorId),
        updatedBy: cleanText(ctx.actorId),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      const version: ContentEntryVersion = {
        id: createId("cver"),
        tenantId: ctx.tenantId,
        entryId: entry.id,
        version: 1,
        data: validated.data,
        changeDescription: cleanText(input.changeDescription),
        createdBy: cleanText(ctx.actorId),
        createdAt: timestamp
      };
      await deps.store.upsertEntry(entry);
      await deps.store.insertVersion(version);
      return buildSnapshot(deps.store, ctx, entry, version);
    },

    async saveEntryVersion(ctx, input) {
      const entry = await deps.store.getEntry(ctx.tenantId, input.entryId);
      if (!entry) return fail("entry_not_found", "Content entry was not found.");
      if (entry.status === "archived") return fail("entry_archived", "Archived entries cannot be edited.");
      const fields = await deps.store.listFields(ctx.tenantId, entry.contentTypeId);
      const validated = validateData(fields, input.data, enforceRequiredFields);
      if (!validated.ok || !validated.data) return failFrom<ContentEntrySnapshot>(validated);
      const latest = await latestVersion(deps.store, ctx.tenantId, entry.id);
      const timestamp = now(ctx);
      const version: ContentEntryVersion = {
        id: createId("cver"),
        tenantId: ctx.tenantId,
        entryId: entry.id,
        version: (latest?.version ?? 0) + 1,
        data: validated.data,
        changeDescription: cleanText(input.changeDescription),
        createdBy: cleanText(ctx.actorId),
        createdAt: timestamp
      };
      const updatedEntry: ContentEntry = {
        ...entry,
        status: entry.status === "published" ? "draft" : entry.status,
        updatedBy: cleanText(ctx.actorId),
        updatedAt: timestamp
      };
      await deps.store.insertVersion(version);
      await deps.store.upsertEntry(updatedEntry);
      return buildSnapshot(deps.store, ctx, updatedEntry, version);
    },

    async publishEntry(ctx, input) {
      const entry = await deps.store.getEntry(ctx.tenantId, input.entryId);
      if (!entry) return fail("entry_not_found", "Content entry was not found.");
      if (entry.status === "archived") return fail("entry_archived", "Archived entries cannot be published.");
      const versions = await deps.store.listVersionsForEntry(ctx.tenantId, entry.id);
      const versionNumber = input.version ?? publishedOrLatestVersionNumber(entry, versions);
      if (!versionNumber) return fail("version_not_found", "No content entry version is available to publish.");
      const version = await deps.store.getVersionByNumber(ctx.tenantId, entry.id, versionNumber);
      if (!version) return fail("version_not_found", "Content entry version was not found.");
      const timestamp = now(ctx);
      const updatedEntry: ContentEntry = {
        ...entry,
        status: "published" satisfies ContentStatus,
        publishedAt: timestamp,
        publishedVersion: version.version,
        scheduledAt: null,
        updatedBy: cleanText(ctx.actorId),
        updatedAt: timestamp
      };
      await deps.store.upsertEntry(updatedEntry);
      return buildSnapshot(deps.store, ctx, updatedEntry, version);
    },

    async archiveEntry(ctx, input) {
      const entry = await deps.store.getEntry(ctx.tenantId, input.entryId);
      if (!entry) return fail("entry_not_found", "Content entry was not found.");
      const timestamp = now(ctx);
      const updatedEntry: ContentEntry = {
        ...entry,
        status: "archived",
        updatedBy: cleanText(ctx.actorId),
        updatedAt: timestamp
      };
      await deps.store.upsertEntry(updatedEntry);
      return ok(updatedEntry);
    },

    async upsertLocalization(ctx, input) {
      const version = await deps.store.getVersion(ctx.tenantId, input.entryVersionId);
      if (!version) return fail("version_not_found", "Content entry version was not found.");
      const localeCode = normalizeLocaleCode(input.locale);
      if (!localeCode.ok || !localeCode.data) return failFrom<ContentEntryLocalization>(localeCode);
      const locale = await deps.store.getLocaleByCode(ctx.tenantId, localeCode.data);
      if (!locale || !locale.isEnabled) return fail("locale_not_enabled", "Locale must exist and be enabled before content can be localized.");
      const status = input.status ?? "draft";
      if (!LOCALIZATION_STATUSES.has(status)) return fail("localization_status_invalid", "Localization status is not supported.");
      const existing = await deps.store.getLocalization(ctx.tenantId, version.id, localeCode.data);
      const timestamp = now(ctx);
      const localization: ContentEntryLocalization = {
        id: existing?.id ?? createId("cloc"),
        tenantId: ctx.tenantId,
        entryVersionId: version.id,
        locale: localeCode.data,
        data: { ...input.data },
        status,
        translatedBy: cleanText(ctx.actorId),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertLocalization(localization);
      return ok(localization);
    },

    async createMediaAsset(ctx, input) {
      const filename = cleanText(input.filename);
      const mimeType = cleanText(input.mimeType);
      const storageKey = cleanText(input.storageKey);
      if (!filename) return fail("filename_required", "Filename is required.");
      if (!mimeType) return fail("mime_type_required", "MIME type is required.");
      if (!storageKey || storageKey.includes("..")) return fail("storage_key_invalid", "Storage key is required and cannot contain parent traversal.");
      if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 0) return fail("size_invalid", "Media size must be a non-negative integer.");
      const timestamp = now(ctx);
      const media: CmsMediaAsset = {
        id: createId("cmed"),
        tenantId: ctx.tenantId,
        filename,
        originalFilename: cleanText(input.originalFilename) ?? filename,
        mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width ?? null,
        height: input.height ?? null,
        durationSeconds: input.durationSeconds ?? null,
        storageKey,
        publicUrl: cleanText(input.publicUrl),
        alt: cleanText(input.alt),
        caption: cleanText(input.caption),
        title: cleanText(input.title),
        description: cleanText(input.description),
        metadata: ensureObject(input.metadata),
        folder: cleanText(input.folder),
        tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
        uploadedBy: cleanText(ctx.actorId),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertMediaAsset(media);
      return ok(media);
    },

    async listMediaAssets(ctx, limit = 50) {
      return ok(await deps.store.listMediaAssets(ctx.tenantId, limit));
    },

    async getEntrySnapshot(ctx, input) {
      const entry = await deps.store.getEntry(ctx.tenantId, input.entryId);
      if (!entry) return fail("entry_not_found", "Content entry was not found.");
      const version = input.version
        ? await deps.store.getVersionByNumber(ctx.tenantId, entry.id, input.version)
        : entry.publishedVersion
          ? await deps.store.getVersionByNumber(ctx.tenantId, entry.id, entry.publishedVersion)
          : await latestVersion(deps.store, ctx.tenantId, entry.id);
      if (!version) return fail("version_not_found", "Content entry version was not found.");
      return buildSnapshot(deps.store, ctx, entry, version, cleanText(input.locale));
    }
  };
}

export function getContentCmsModuleStatus() {
  return { id: "content-cms", status: "draft" } as const;
}
