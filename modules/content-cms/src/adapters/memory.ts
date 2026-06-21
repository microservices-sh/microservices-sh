import type { ContentCmsStore } from "../ports";
import type {
  CmsLocale,
  CmsMediaAsset,
  ContentEntry,
  ContentEntryLocalization,
  ContentEntryVersion,
  ContentFieldDefinition,
  ContentTypeDefinition
} from "../types";

export interface ContentCmsMemoryStoreState {
  contentTypes?: ContentTypeDefinition[];
  fields?: ContentFieldDefinition[];
  entries?: ContentEntry[];
  versions?: ContentEntryVersion[];
  localizations?: ContentEntryLocalization[];
  locales?: CmsLocale[];
  mediaAssets?: CmsMediaAsset[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function tenantKey(tenantId: string, value: string): string {
  return `${tenantId}:${value}`;
}

function fieldKey(tenantId: string, contentTypeId: string, apiId: string): string {
  return `${tenantId}:${contentTypeId}:${apiId}`;
}

function versionKey(tenantId: string, entryId: string, version: number): string {
  return `${tenantId}:${entryId}:${version}`;
}

function localizationKey(tenantId: string, entryVersionId: string, locale: string): string {
  return `${tenantId}:${entryVersionId}:${locale.toLowerCase()}`;
}

export function createContentCmsMemoryStore(initialState: ContentCmsMemoryStoreState = {}): ContentCmsStore {
  const contentTypes = new Map<string, ContentTypeDefinition>();
  const contentTypeApiIds = new Map<string, string>();
  const fields = new Map<string, ContentFieldDefinition>();
  const fieldApiIds = new Map<string, string>();
  const entries = new Map<string, ContentEntry>();
  const versions = new Map<string, ContentEntryVersion>();
  const versionNumbers = new Map<string, string>();
  const localizations = new Map<string, ContentEntryLocalization>();
  const locales = new Map<string, CmsLocale>();
  const localeCodes = new Map<string, string>();
  const mediaAssets = new Map<string, CmsMediaAsset>();

  for (const contentType of initialState.contentTypes ?? []) {
    contentTypes.set(contentType.id, copy(contentType));
    contentTypeApiIds.set(tenantKey(contentType.tenantId, contentType.apiId), contentType.id);
  }
  for (const field of initialState.fields ?? []) {
    fields.set(field.id, copy(field));
    fieldApiIds.set(fieldKey(field.tenantId, field.contentTypeId, field.apiId), field.id);
  }
  for (const entry of initialState.entries ?? []) entries.set(entry.id, copy(entry));
  for (const version of initialState.versions ?? []) {
    versions.set(version.id, copy(version));
    versionNumbers.set(versionKey(version.tenantId, version.entryId, version.version), version.id);
  }
  for (const localization of initialState.localizations ?? []) {
    localizations.set(localizationKey(localization.tenantId, localization.entryVersionId, localization.locale), copy(localization));
  }
  for (const locale of initialState.locales ?? []) {
    locales.set(locale.id, copy(locale));
    localeCodes.set(tenantKey(locale.tenantId, locale.code.toLowerCase()), locale.id);
  }
  for (const media of initialState.mediaAssets ?? []) mediaAssets.set(media.id, copy(media));

  return {
    async getContentType(tenantId, contentTypeId) {
      const contentType = contentTypes.get(contentTypeId);
      return contentType?.tenantId === tenantId ? copy(contentType) : null;
    },
    async getContentTypeByApiId(tenantId, apiId) {
      const id = contentTypeApiIds.get(tenantKey(tenantId, apiId));
      const contentType = id ? contentTypes.get(id) : null;
      return contentType ? copy(contentType) : null;
    },
    async upsertContentType(contentType) {
      const existing = contentTypes.get(contentType.id);
      if (existing) contentTypeApiIds.delete(tenantKey(existing.tenantId, existing.apiId));
      contentTypes.set(contentType.id, copy(contentType));
      contentTypeApiIds.set(tenantKey(contentType.tenantId, contentType.apiId), contentType.id);
    },
    async listContentTypes(tenantId) {
      return [...contentTypes.values()]
        .filter((contentType) => contentType.tenantId === tenantId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(copy);
    },

    async getField(tenantId, fieldId) {
      const field = fields.get(fieldId);
      return field?.tenantId === tenantId ? copy(field) : null;
    },
    async getFieldByApiId(tenantId, contentTypeId, apiId) {
      const id = fieldApiIds.get(fieldKey(tenantId, contentTypeId, apiId));
      const field = id ? fields.get(id) : null;
      return field ? copy(field) : null;
    },
    async upsertField(field) {
      const existing = fields.get(field.id);
      if (existing) fieldApiIds.delete(fieldKey(existing.tenantId, existing.contentTypeId, existing.apiId));
      fields.set(field.id, copy(field));
      fieldApiIds.set(fieldKey(field.tenantId, field.contentTypeId, field.apiId), field.id);
    },
    async listFields(tenantId, contentTypeId) {
      return [...fields.values()]
        .filter((field) => field.tenantId === tenantId && field.contentTypeId === contentTypeId)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
        .map(copy);
    },

    async getEntry(tenantId, entryId) {
      const entry = entries.get(entryId);
      return entry?.tenantId === tenantId ? copy(entry) : null;
    },
    async upsertEntry(entry) {
      entries.set(entry.id, copy(entry));
    },
    async listEntriesByContentType(tenantId, contentTypeId, includeArchived = false) {
      return [...entries.values()]
        .filter((entry) => entry.tenantId === tenantId && entry.contentTypeId === contentTypeId && (includeArchived || entry.status !== "archived"))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(copy);
    },

    async getVersion(tenantId, versionId) {
      const version = versions.get(versionId);
      return version?.tenantId === tenantId ? copy(version) : null;
    },
    async getVersionByNumber(tenantId, entryId, version) {
      const id = versionNumbers.get(versionKey(tenantId, entryId, version));
      const record = id ? versions.get(id) : null;
      return record ? copy(record) : null;
    },
    async insertVersion(version) {
      versions.set(version.id, copy(version));
      versionNumbers.set(versionKey(version.tenantId, version.entryId, version.version), version.id);
    },
    async listVersionsForEntry(tenantId, entryId) {
      return [...versions.values()]
        .filter((version) => version.tenantId === tenantId && version.entryId === entryId)
        .sort((a, b) => b.version - a.version)
        .map(copy);
    },

    async getLocalization(tenantId, entryVersionId, locale) {
      const localization = localizations.get(localizationKey(tenantId, entryVersionId, locale));
      return localization ? copy(localization) : null;
    },
    async upsertLocalization(localization) {
      localizations.set(localizationKey(localization.tenantId, localization.entryVersionId, localization.locale), copy(localization));
    },
    async listLocalizationsForVersion(tenantId, entryVersionId) {
      return [...localizations.values()]
        .filter((localization) => localization.tenantId === tenantId && localization.entryVersionId === entryVersionId)
        .sort((a, b) => a.locale.localeCompare(b.locale))
        .map(copy);
    },

    async getLocale(tenantId, localeId) {
      const locale = locales.get(localeId);
      return locale?.tenantId === tenantId ? copy(locale) : null;
    },
    async getLocaleByCode(tenantId, code) {
      const id = localeCodes.get(tenantKey(tenantId, code.toLowerCase()));
      const locale = id ? locales.get(id) : null;
      return locale ? copy(locale) : null;
    },
    async getDefaultLocale(tenantId) {
      const locale = [...locales.values()].find((candidate) => candidate.tenantId === tenantId && candidate.isDefault);
      return locale ? copy(locale) : null;
    },
    async upsertLocale(locale) {
      const existing = locales.get(locale.id);
      if (existing) localeCodes.delete(tenantKey(existing.tenantId, existing.code.toLowerCase()));
      locales.set(locale.id, copy(locale));
      localeCodes.set(tenantKey(locale.tenantId, locale.code.toLowerCase()), locale.id);
    },
    async listLocales(tenantId, includeDisabled = false) {
      return [...locales.values()]
        .filter((locale) => locale.tenantId === tenantId && (includeDisabled || locale.isEnabled))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.code.localeCompare(b.code))
        .map(copy);
    },

    async getMediaAsset(tenantId, mediaId) {
      const media = mediaAssets.get(mediaId);
      return media?.tenantId === tenantId ? copy(media) : null;
    },
    async upsertMediaAsset(media) {
      mediaAssets.set(media.id, copy(media));
    },
    async listMediaAssets(tenantId, limit = 50) {
      return [...mediaAssets.values()]
        .filter((media) => media.tenantId === tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(copy);
    }
  };
}
