import { z } from "zod";

export const contentFieldTypeSchema = z.enum(["text", "richtext", "number", "boolean", "date", "media", "reference", "json", "slug", "enum", "color", "email", "url"]);
export const contentStatusSchema = z.enum(["draft", "review", "published", "archived"]);
export const localizationStatusSchema = z.enum(["draft", "review", "ready"]);
export const localeDirectionSchema = z.enum(["ltr", "rtl"]);
export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const contentCmsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  enforceRequiredFields: z.boolean().default(true)
});

export const contentTypeDefinitionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  apiId: z.string().min(1),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  isSingleton: z.boolean(),
  isSystem: z.boolean(),
  sortField: z.string().min(1),
  sortOrder: z.enum(["asc", "desc"]),
  displayField: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const contentFieldDefinitionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  contentTypeId: z.string().min(1),
  name: z.string().min(1),
  apiId: z.string().min(1),
  type: contentFieldTypeSchema,
  description: z.string().nullable(),
  config: jsonObjectSchema,
  validation: jsonObjectSchema,
  defaultValue: z.unknown(),
  isRequired: z.boolean(),
  isUnique: z.boolean(),
  isLocalizable: z.boolean(),
  isHidden: z.boolean(),
  position: z.number().int(),
  group: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const contentEntrySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  contentTypeId: z.string().min(1),
  status: contentStatusSchema,
  publishedAt: z.string().nullable(),
  publishedVersion: z.number().int().nullable(),
  scheduledAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const contentEntryVersionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  entryId: z.string().min(1),
  version: z.number().int().positive(),
  data: jsonObjectSchema,
  changeDescription: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().min(1)
});

export const contentEntryLocalizationSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  entryVersionId: z.string().min(1),
  locale: z.string().min(2),
  data: jsonObjectSchema,
  status: localizationStatusSchema,
  translatedBy: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const cmsLocaleSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  code: z.string().min(2),
  name: z.string().min(1),
  nativeName: z.string().nullable(),
  isDefault: z.boolean(),
  isEnabled: z.boolean(),
  fallbackLocale: z.string().nullable(),
  direction: localeDirectionSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const cmsMediaAssetSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  filename: z.string().min(1),
  originalFilename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  storageKey: z.string().min(1),
  publicUrl: z.string().nullable(),
  alt: z.string().nullable(),
  caption: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  metadata: jsonObjectSchema,
  folder: z.string().nullable(),
  tags: z.array(z.string()),
  uploadedBy: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const createContentTypeInputSchema = z.object({
  name: z.string().min(1),
  apiId: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  isSingleton: z.boolean().optional(),
  isSystem: z.boolean().optional(),
  sortField: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  displayField: z.string().optional()
});

export const addContentFieldInputSchema = z.object({
  contentTypeId: z.string().min(1),
  name: z.string().min(1),
  apiId: z.string().min(1),
  type: contentFieldTypeSchema,
  description: z.string().nullable().optional(),
  config: jsonObjectSchema.optional(),
  validation: jsonObjectSchema.optional(),
  defaultValue: z.unknown().optional(),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isLocalizable: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  position: z.number().int().optional(),
  group: z.string().nullable().optional()
});

export const createContentEntryInputSchema = z.object({
  contentTypeId: z.string().min(1),
  data: jsonObjectSchema,
  status: z.enum(["draft", "review"]).optional(),
  scheduledAt: z.string().nullable().optional(),
  changeDescription: z.string().nullable().optional()
});

export const contentEntrySnapshotSchema = z.object({
  entry: contentEntrySchema,
  contentType: contentTypeDefinitionSchema,
  fields: z.array(contentFieldDefinitionSchema),
  version: contentEntryVersionSchema,
  data: jsonObjectSchema,
  localization: contentEntryLocalizationSchema.nullable()
});

export const contentCmsRecordSchema = z.union([
  contentTypeDefinitionSchema,
  contentFieldDefinitionSchema,
  contentEntrySchema,
  contentEntryVersionSchema,
  contentEntryLocalizationSchema,
  cmsLocaleSchema,
  cmsMediaAssetSchema
]);
