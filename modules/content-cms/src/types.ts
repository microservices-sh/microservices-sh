export interface ContentCmsConfig {
  enabled: boolean;
  enforceRequiredFields?: boolean;
}

export type ContentCmsIdPrefix = "ctyp" | "cfld" | "cent" | "cver" | "cloc" | "cmed" | "clng";
export type ContentCmsIdFactory = (prefix: ContentCmsIdPrefix) => string;

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export type ContentFieldType =
  | "text"
  | "richtext"
  | "number"
  | "boolean"
  | "date"
  | "media"
  | "reference"
  | "json"
  | "slug"
  | "enum"
  | "color"
  | "email"
  | "url";

export type ContentStatus = "draft" | "review" | "published" | "archived";
export type LocalizationStatus = "draft" | "review" | "ready";
export type SortOrder = "asc" | "desc";
export type LocaleDirection = "ltr" | "rtl";

export interface FieldConfig {
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  toolbar?: string[];
  allowedTags?: string[];
  min?: number;
  max?: number;
  step?: number;
  format?: string;
  precision?: number;
  includeTime?: boolean;
  dateFormat?: string;
  allowedTypes?: string[];
  maxSize?: number;
  multiple?: boolean;
  targetType?: string;
  options?: Array<{ value: string; label: string }>;
  sourceField?: string;
  prefix?: string;
  presets?: string[];
  [key: string]: unknown;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  unique?: boolean;
  custom?: string;
  [key: string]: unknown;
}

export interface ContentTypeDefinition {
  id: string;
  tenantId: string;
  name: string;
  apiId: string;
  description: string | null;
  icon: string | null;
  isSingleton: boolean;
  isSystem: boolean;
  sortField: string;
  sortOrder: SortOrder;
  displayField: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentFieldDefinition {
  id: string;
  tenantId: string;
  contentTypeId: string;
  name: string;
  apiId: string;
  type: ContentFieldType;
  description: string | null;
  config: FieldConfig;
  validation: FieldValidation;
  defaultValue: unknown;
  isRequired: boolean;
  isUnique: boolean;
  isLocalizable: boolean;
  isHidden: boolean;
  position: number;
  group: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentEntry {
  id: string;
  tenantId: string;
  contentTypeId: string;
  status: ContentStatus;
  publishedAt: string | null;
  publishedVersion: number | null;
  scheduledAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentEntryVersion {
  id: string;
  tenantId: string;
  entryId: string;
  version: number;
  data: Record<string, unknown>;
  changeDescription: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ContentEntryLocalization {
  id: string;
  tenantId: string;
  entryVersionId: string;
  locale: string;
  data: Record<string, unknown>;
  status: LocalizationStatus;
  translatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsLocale {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  nativeName: string | null;
  isDefault: boolean;
  isEnabled: boolean;
  fallbackLocale: string | null;
  direction: LocaleDirection;
  createdAt: string;
  updatedAt: string;
}

export interface CmsMediaAsset {
  id: string;
  tenantId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  storageKey: string;
  publicUrl: string | null;
  alt: string | null;
  caption: string | null;
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  folder: string | null;
  tags: string[];
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContentTypeInput {
  name: string;
  apiId: string;
  description?: string | null;
  icon?: string | null;
  isSingleton?: boolean;
  isSystem?: boolean;
  sortField?: string;
  sortOrder?: SortOrder;
  displayField?: string;
}

export interface AddContentFieldInput {
  contentTypeId: string;
  name: string;
  apiId: string;
  type: ContentFieldType;
  description?: string | null;
  config?: FieldConfig;
  validation?: FieldValidation;
  defaultValue?: unknown;
  isRequired?: boolean;
  isUnique?: boolean;
  isLocalizable?: boolean;
  isHidden?: boolean;
  position?: number;
  group?: string | null;
}

export interface CreateContentEntryInput {
  contentTypeId: string;
  data: Record<string, unknown>;
  status?: Extract<ContentStatus, "draft" | "review">;
  scheduledAt?: string | null;
  changeDescription?: string | null;
}

export interface SaveEntryVersionInput {
  entryId: string;
  data: Record<string, unknown>;
  changeDescription?: string | null;
}

export interface PublishEntryInput {
  entryId: string;
  version?: number;
}

export interface ArchiveEntryInput {
  entryId: string;
}

export interface UpsertLocalizationInput {
  entryVersionId: string;
  locale: string;
  data: Record<string, unknown>;
  status?: LocalizationStatus;
}

export interface CreateLocaleInput {
  code: string;
  name: string;
  nativeName?: string | null;
  isDefault?: boolean;
  isEnabled?: boolean;
  fallbackLocale?: string | null;
  direction?: LocaleDirection;
}

export interface CreateMediaAssetInput {
  filename: string;
  originalFilename?: string | null;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  storageKey: string;
  publicUrl?: string | null;
  alt?: string | null;
  caption?: string | null;
  title?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  folder?: string | null;
  tags?: string[];
}

export interface GetEntrySnapshotInput {
  entryId: string;
  version?: number;
  locale?: string | null;
}

export interface ContentEntrySnapshot {
  entry: ContentEntry;
  contentType: ContentTypeDefinition;
  fields: ContentFieldDefinition[];
  version: ContentEntryVersion;
  data: Record<string, unknown>;
  localization: ContentEntryLocalization | null;
}

export type ContentCmsRecord =
  | ContentTypeDefinition
  | ContentFieldDefinition
  | ContentEntry
  | ContentEntryVersion
  | ContentEntryLocalization
  | CmsLocale
  | CmsMediaAsset;

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
