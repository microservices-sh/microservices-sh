import type { ContentCmsStore } from "../ports";
import type {
  CmsLocale,
  CmsMediaAsset,
  ContentEntry,
  ContentEntryLocalization,
  ContentEntryVersion,
  ContentFieldDefinition,
  ContentFieldType,
  ContentStatus,
  LocaleDirection,
  LocalizationStatus,
  SortOrder
} from "../types";
import type { ContentTypeDefinition } from "../types";

const CONTENT_TYPE_COLS = "id, tenant_id, name, api_id, description, icon, is_singleton, is_system, sort_field, sort_order, display_field, created_at, updated_at";
const FIELD_COLS =
  "id, tenant_id, content_type_id, name, api_id, type, description, config_json, validation_json, default_value_json, is_required, is_unique, is_localizable, is_hidden, position, field_group, created_at, updated_at";
const ENTRY_COLS = "id, tenant_id, content_type_id, status, published_at, published_version, scheduled_at, created_by, updated_by, created_at, updated_at";
const VERSION_COLS = "id, tenant_id, entry_id, version, data_json, change_description, created_by, created_at";
const LOCALIZATION_COLS = "id, tenant_id, entry_version_id, locale, data_json, status, translated_by, created_at, updated_at";
const LOCALE_COLS = "id, tenant_id, code, name, native_name, is_default, is_enabled, fallback_locale, direction, created_at, updated_at";
const MEDIA_COLS =
  "id, tenant_id, filename, original_filename, mime_type, size_bytes, width, height, duration_seconds, storage_key, public_url, alt, caption, title, description, metadata_json, folder, tags_json, uploaded_by, created_at, updated_at";

function bool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseArray(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toContentType(row: Record<string, unknown>): ContentTypeDefinition {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    apiId: String(row.api_id),
    description: nullable(row.description),
    icon: nullable(row.icon),
    isSingleton: bool(row.is_singleton),
    isSystem: bool(row.is_system),
    sortField: String(row.sort_field),
    sortOrder: String(row.sort_order) as SortOrder,
    displayField: String(row.display_field),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toField(row: Record<string, unknown>): ContentFieldDefinition {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    contentTypeId: String(row.content_type_id),
    name: String(row.name),
    apiId: String(row.api_id),
    type: String(row.type) as ContentFieldType,
    description: nullable(row.description),
    config: parseObject(row.config_json),
    validation: parseObject(row.validation_json),
    defaultValue: parseJsonValue(row.default_value_json),
    isRequired: bool(row.is_required),
    isUnique: bool(row.is_unique),
    isLocalizable: bool(row.is_localizable),
    isHidden: bool(row.is_hidden),
    position: Number(row.position ?? 0),
    group: nullable(row.field_group),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toEntry(row: Record<string, unknown>): ContentEntry {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    contentTypeId: String(row.content_type_id),
    status: String(row.status) as ContentStatus,
    publishedAt: nullable(row.published_at),
    publishedVersion: nullableNumber(row.published_version),
    scheduledAt: nullable(row.scheduled_at),
    createdBy: nullable(row.created_by),
    updatedBy: nullable(row.updated_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toVersion(row: Record<string, unknown>): ContentEntryVersion {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    entryId: String(row.entry_id),
    version: Number(row.version ?? 0),
    data: parseObject(row.data_json),
    changeDescription: nullable(row.change_description),
    createdBy: nullable(row.created_by),
    createdAt: String(row.created_at)
  };
}

function toLocalization(row: Record<string, unknown>): ContentEntryLocalization {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    entryVersionId: String(row.entry_version_id),
    locale: String(row.locale),
    data: parseObject(row.data_json),
    status: String(row.status) as LocalizationStatus,
    translatedBy: nullable(row.translated_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toLocale(row: Record<string, unknown>): CmsLocale {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    code: String(row.code),
    name: String(row.name),
    nativeName: nullable(row.native_name),
    isDefault: bool(row.is_default),
    isEnabled: bool(row.is_enabled),
    fallbackLocale: nullable(row.fallback_locale),
    direction: String(row.direction) as LocaleDirection,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toMedia(row: Record<string, unknown>): CmsMediaAsset {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    filename: String(row.filename),
    originalFilename: String(row.original_filename),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes ?? 0),
    width: nullableNumber(row.width),
    height: nullableNumber(row.height),
    durationSeconds: nullableNumber(row.duration_seconds),
    storageKey: String(row.storage_key),
    publicUrl: nullable(row.public_url),
    alt: nullable(row.alt),
    caption: nullable(row.caption),
    title: nullable(row.title),
    description: nullable(row.description),
    metadata: parseObject(row.metadata_json),
    folder: nullable(row.folder),
    tags: parseArray(row.tags_json),
    uploadedBy: nullable(row.uploaded_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1ContentCmsStore(db: D1Database): ContentCmsStore {
  return {
    async getContentType(tenantId, contentTypeId) {
      const row = await db.prepare(`SELECT ${CONTENT_TYPE_COLS} FROM cms_content_types WHERE tenant_id = ? AND id = ?`).bind(tenantId, contentTypeId).first<Record<string, unknown>>();
      return row ? toContentType(row) : null;
    },
    async getContentTypeByApiId(tenantId, apiId) {
      const row = await db.prepare(`SELECT ${CONTENT_TYPE_COLS} FROM cms_content_types WHERE tenant_id = ? AND api_id = ?`).bind(tenantId, apiId).first<Record<string, unknown>>();
      return row ? toContentType(row) : null;
    },
    async upsertContentType(contentType) {
      await db
        .prepare(
          `INSERT INTO cms_content_types (${CONTENT_TYPE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, id) DO UPDATE SET name = excluded.name, api_id = excluded.api_id, description = excluded.description, icon = excluded.icon, is_singleton = excluded.is_singleton, is_system = excluded.is_system, sort_field = excluded.sort_field, sort_order = excluded.sort_order, display_field = excluded.display_field, updated_at = excluded.updated_at`
        )
        .bind(
          contentType.id,
          contentType.tenantId,
          contentType.name,
          contentType.apiId,
          contentType.description,
          contentType.icon,
          contentType.isSingleton ? 1 : 0,
          contentType.isSystem ? 1 : 0,
          contentType.sortField,
          contentType.sortOrder,
          contentType.displayField,
          contentType.createdAt,
          contentType.updatedAt
        )
        .run();
    },
    async listContentTypes(tenantId) {
      const result = await db.prepare(`SELECT ${CONTENT_TYPE_COLS} FROM cms_content_types WHERE tenant_id = ? ORDER BY name ASC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toContentType);
    },

    async getField(tenantId, fieldId) {
      const row = await db.prepare(`SELECT ${FIELD_COLS} FROM cms_content_fields WHERE tenant_id = ? AND id = ?`).bind(tenantId, fieldId).first<Record<string, unknown>>();
      return row ? toField(row) : null;
    },
    async getFieldByApiId(tenantId, contentTypeId, apiId) {
      const row = await db.prepare(`SELECT ${FIELD_COLS} FROM cms_content_fields WHERE tenant_id = ? AND content_type_id = ? AND api_id = ?`).bind(tenantId, contentTypeId, apiId).first<Record<string, unknown>>();
      return row ? toField(row) : null;
    },
    async upsertField(field) {
      await db
        .prepare(
          `INSERT INTO cms_content_fields (${FIELD_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, id) DO UPDATE SET content_type_id = excluded.content_type_id, name = excluded.name, api_id = excluded.api_id, type = excluded.type, description = excluded.description, config_json = excluded.config_json, validation_json = excluded.validation_json, default_value_json = excluded.default_value_json, is_required = excluded.is_required, is_unique = excluded.is_unique, is_localizable = excluded.is_localizable, is_hidden = excluded.is_hidden, position = excluded.position, field_group = excluded.field_group, updated_at = excluded.updated_at`
        )
        .bind(
          field.id,
          field.tenantId,
          field.contentTypeId,
          field.name,
          field.apiId,
          field.type,
          field.description,
          JSON.stringify(field.config),
          JSON.stringify(field.validation),
          JSON.stringify(field.defaultValue),
          field.isRequired ? 1 : 0,
          field.isUnique ? 1 : 0,
          field.isLocalizable ? 1 : 0,
          field.isHidden ? 1 : 0,
          field.position,
          field.group,
          field.createdAt,
          field.updatedAt
        )
        .run();
    },
    async listFields(tenantId, contentTypeId) {
      const result = await db.prepare(`SELECT ${FIELD_COLS} FROM cms_content_fields WHERE tenant_id = ? AND content_type_id = ? ORDER BY position ASC, name ASC`).bind(tenantId, contentTypeId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toField);
    },

    async getEntry(tenantId, entryId) {
      const row = await db.prepare(`SELECT ${ENTRY_COLS} FROM cms_content_entries WHERE tenant_id = ? AND id = ?`).bind(tenantId, entryId).first<Record<string, unknown>>();
      return row ? toEntry(row) : null;
    },
    async upsertEntry(entry) {
      await db
        .prepare(
          `INSERT INTO cms_content_entries (${ENTRY_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, id) DO UPDATE SET content_type_id = excluded.content_type_id, status = excluded.status, published_at = excluded.published_at, published_version = excluded.published_version, scheduled_at = excluded.scheduled_at, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
        )
        .bind(
          entry.id,
          entry.tenantId,
          entry.contentTypeId,
          entry.status,
          entry.publishedAt,
          entry.publishedVersion,
          entry.scheduledAt,
          entry.createdBy,
          entry.updatedBy,
          entry.createdAt,
          entry.updatedAt
        )
        .run();
    },
    async listEntriesByContentType(tenantId, contentTypeId, includeArchived = false) {
      const result = await db
        .prepare(`SELECT ${ENTRY_COLS} FROM cms_content_entries WHERE tenant_id = ? AND content_type_id = ? ${includeArchived ? "" : "AND status != 'archived'"} ORDER BY updated_at DESC`)
        .bind(tenantId, contentTypeId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toEntry);
    },

    async getVersion(tenantId, versionId) {
      const row = await db.prepare(`SELECT ${VERSION_COLS} FROM cms_content_entry_versions WHERE tenant_id = ? AND id = ?`).bind(tenantId, versionId).first<Record<string, unknown>>();
      return row ? toVersion(row) : null;
    },
    async getVersionByNumber(tenantId, entryId, version) {
      const row = await db.prepare(`SELECT ${VERSION_COLS} FROM cms_content_entry_versions WHERE tenant_id = ? AND entry_id = ? AND version = ?`).bind(tenantId, entryId, version).first<Record<string, unknown>>();
      return row ? toVersion(row) : null;
    },
    async insertVersion(version) {
      await db
        .prepare(`INSERT INTO cms_content_entry_versions (${VERSION_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(version.id, version.tenantId, version.entryId, version.version, JSON.stringify(version.data), version.changeDescription, version.createdBy, version.createdAt)
        .run();
    },
    async listVersionsForEntry(tenantId, entryId) {
      const result = await db.prepare(`SELECT ${VERSION_COLS} FROM cms_content_entry_versions WHERE tenant_id = ? AND entry_id = ? ORDER BY version DESC`).bind(tenantId, entryId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toVersion);
    },

    async getLocalization(tenantId, entryVersionId, locale) {
      const row = await db.prepare(`SELECT ${LOCALIZATION_COLS} FROM cms_content_entry_localizations WHERE tenant_id = ? AND entry_version_id = ? AND locale = ?`).bind(tenantId, entryVersionId, locale).first<Record<string, unknown>>();
      return row ? toLocalization(row) : null;
    },
    async upsertLocalization(localization) {
      await db
        .prepare(
          `INSERT INTO cms_content_entry_localizations (${LOCALIZATION_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, entry_version_id, locale) DO UPDATE SET data_json = excluded.data_json, status = excluded.status, translated_by = excluded.translated_by, updated_at = excluded.updated_at`
        )
        .bind(
          localization.id,
          localization.tenantId,
          localization.entryVersionId,
          localization.locale,
          JSON.stringify(localization.data),
          localization.status,
          localization.translatedBy,
          localization.createdAt,
          localization.updatedAt
        )
        .run();
    },
    async listLocalizationsForVersion(tenantId, entryVersionId) {
      const result = await db.prepare(`SELECT ${LOCALIZATION_COLS} FROM cms_content_entry_localizations WHERE tenant_id = ? AND entry_version_id = ? ORDER BY locale ASC`).bind(tenantId, entryVersionId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toLocalization);
    },

    async getLocale(tenantId, localeId) {
      const row = await db.prepare(`SELECT ${LOCALE_COLS} FROM cms_locales WHERE tenant_id = ? AND id = ?`).bind(tenantId, localeId).first<Record<string, unknown>>();
      return row ? toLocale(row) : null;
    },
    async getLocaleByCode(tenantId, code) {
      const row = await db.prepare(`SELECT ${LOCALE_COLS} FROM cms_locales WHERE tenant_id = ? AND code = ?`).bind(tenantId, code).first<Record<string, unknown>>();
      return row ? toLocale(row) : null;
    },
    async getDefaultLocale(tenantId) {
      const row = await db.prepare(`SELECT ${LOCALE_COLS} FROM cms_locales WHERE tenant_id = ? AND is_default = 1 LIMIT 1`).bind(tenantId).first<Record<string, unknown>>();
      return row ? toLocale(row) : null;
    },
    async upsertLocale(locale) {
      await db
        .prepare(
          `INSERT INTO cms_locales (${LOCALE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, id) DO UPDATE SET code = excluded.code, name = excluded.name, native_name = excluded.native_name, is_default = excluded.is_default, is_enabled = excluded.is_enabled, fallback_locale = excluded.fallback_locale, direction = excluded.direction, updated_at = excluded.updated_at`
        )
        .bind(
          locale.id,
          locale.tenantId,
          locale.code,
          locale.name,
          locale.nativeName,
          locale.isDefault ? 1 : 0,
          locale.isEnabled ? 1 : 0,
          locale.fallbackLocale,
          locale.direction,
          locale.createdAt,
          locale.updatedAt
        )
        .run();
    },
    async listLocales(tenantId, includeDisabled = false) {
      const result = await db.prepare(`SELECT ${LOCALE_COLS} FROM cms_locales WHERE tenant_id = ? ${includeDisabled ? "" : "AND is_enabled = 1"} ORDER BY is_default DESC, code ASC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toLocale);
    },

    async getMediaAsset(tenantId, mediaId) {
      const row = await db.prepare(`SELECT ${MEDIA_COLS} FROM cms_media_assets WHERE tenant_id = ? AND id = ?`).bind(tenantId, mediaId).first<Record<string, unknown>>();
      return row ? toMedia(row) : null;
    },
    async upsertMediaAsset(media) {
      await db
        .prepare(
          `INSERT INTO cms_media_assets (${MEDIA_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, id) DO UPDATE SET filename = excluded.filename, original_filename = excluded.original_filename, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes, width = excluded.width, height = excluded.height, duration_seconds = excluded.duration_seconds, storage_key = excluded.storage_key, public_url = excluded.public_url, alt = excluded.alt, caption = excluded.caption, title = excluded.title, description = excluded.description, metadata_json = excluded.metadata_json, folder = excluded.folder, tags_json = excluded.tags_json, updated_at = excluded.updated_at`
        )
        .bind(
          media.id,
          media.tenantId,
          media.filename,
          media.originalFilename,
          media.mimeType,
          media.sizeBytes,
          media.width,
          media.height,
          media.durationSeconds,
          media.storageKey,
          media.publicUrl,
          media.alt,
          media.caption,
          media.title,
          media.description,
          JSON.stringify(media.metadata),
          media.folder,
          JSON.stringify(media.tags),
          media.uploadedBy,
          media.createdAt,
          media.updatedAt
        )
        .run();
    },
    async listMediaAssets(tenantId, limit = 50) {
      const result = await db.prepare(`SELECT ${MEDIA_COLS} FROM cms_media_assets WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`).bind(tenantId, limit).all<Record<string, unknown>>();
      return (result.results ?? []).map(toMedia);
    }
  };
}
