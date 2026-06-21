import type {
  CmsLocale,
  CmsMediaAsset,
  ContentEntry,
  ContentEntryLocalization,
  ContentEntryVersion,
  ContentFieldDefinition,
  ContentTypeDefinition
} from "../types";

export interface ContentCmsStore {
  getContentType(tenantId: string, contentTypeId: string): Promise<ContentTypeDefinition | null>;
  getContentTypeByApiId(tenantId: string, apiId: string): Promise<ContentTypeDefinition | null>;
  upsertContentType(contentType: ContentTypeDefinition): Promise<void>;
  listContentTypes(tenantId: string): Promise<ContentTypeDefinition[]>;

  getField(tenantId: string, fieldId: string): Promise<ContentFieldDefinition | null>;
  getFieldByApiId(tenantId: string, contentTypeId: string, apiId: string): Promise<ContentFieldDefinition | null>;
  upsertField(field: ContentFieldDefinition): Promise<void>;
  listFields(tenantId: string, contentTypeId: string): Promise<ContentFieldDefinition[]>;

  getEntry(tenantId: string, entryId: string): Promise<ContentEntry | null>;
  upsertEntry(entry: ContentEntry): Promise<void>;
  listEntriesByContentType(tenantId: string, contentTypeId: string, includeArchived?: boolean): Promise<ContentEntry[]>;

  getVersion(tenantId: string, versionId: string): Promise<ContentEntryVersion | null>;
  getVersionByNumber(tenantId: string, entryId: string, version: number): Promise<ContentEntryVersion | null>;
  insertVersion(version: ContentEntryVersion): Promise<void>;
  listVersionsForEntry(tenantId: string, entryId: string): Promise<ContentEntryVersion[]>;

  getLocalization(tenantId: string, entryVersionId: string, locale: string): Promise<ContentEntryLocalization | null>;
  upsertLocalization(localization: ContentEntryLocalization): Promise<void>;
  listLocalizationsForVersion(tenantId: string, entryVersionId: string): Promise<ContentEntryLocalization[]>;

  getLocale(tenantId: string, localeId: string): Promise<CmsLocale | null>;
  getLocaleByCode(tenantId: string, code: string): Promise<CmsLocale | null>;
  getDefaultLocale(tenantId: string): Promise<CmsLocale | null>;
  upsertLocale(locale: CmsLocale): Promise<void>;
  listLocales(tenantId: string, includeDisabled?: boolean): Promise<CmsLocale[]>;

  getMediaAsset(tenantId: string, mediaId: string): Promise<CmsMediaAsset | null>;
  upsertMediaAsset(media: CmsMediaAsset): Promise<void>;
  listMediaAssets(tenantId: string, limit?: number): Promise<CmsMediaAsset[]>;
}
