import { z } from "zod";

export const smsVendorSchema = z.enum(["clicksend", "twilio", "sns", "memory"]);
export const smsCampaignStatusSchema = z.enum(["draft", "scheduled", "sending", "completed", "failed", "cancelled"]);
export const smsSendTypeSchema = z.enum(["immediate", "scheduled"]);
export const smsRecipientStatusSchema = z.enum(["pending", "queued", "sent", "delivered", "failed", "skipped"]);
export const smsDeliveryStatusSchema = z.enum(["queued", "sent", "delivered", "failed"]);

export const smsCampaignsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultVendor: smsVendorSchema.optional(),
  maxBatchSize: z.number().int().positive().optional()
});

export const smsCampaignsContactSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  phone: z.string().min(1),
  name: z.string().min(1),
  email: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  optIn: z.boolean(),
  optInDate: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  createdBy: z.string().nullable()
});

export const smsCampaignsContactGroupSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  createdBy: z.string().nullable()
});

export const smsCampaignsTemplateSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  content: z.string().min(1),
  charCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  createdBy: z.string().nullable()
});

export const smsCampaignsProviderConfigSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  vendor: smsVendorSchema,
  isDefault: z.boolean(),
  isEnabled: z.boolean(),
  apiKeyRef: z.string().nullable(),
  senderId: z.string().min(1),
  quotaLimit: z.number().int().nonnegative().nullable(),
  quotaUsed: z.number().int().nonnegative(),
  quotaResetAt: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const smsCampaignsCampaignSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  templateId: z.string().nullable(),
  vendor: smsVendorSchema,
  status: smsCampaignStatusSchema,
  sendType: smsSendTypeSchema,
  scheduledAt: z.string().nullable(),
  message: z.string().min(1),
  totalContacts: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  deliveredCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  totalCostCents: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  updatedAt: z.string().min(1),
  createdBy: z.string().nullable()
});

export const smsCampaignsCampaignRecipientSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  campaignId: z.string().min(1),
  contactId: z.string().min(1),
  phone: z.string().min(1),
  status: smsRecipientStatusSchema,
  vendorMessageId: z.string().nullable(),
  costCents: z.number().int().nonnegative(),
  errorMessage: z.string().nullable(),
  sentAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const smsCampaignsDeliveryLogSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  campaignId: z.string().nullable(),
  recipientId: z.string().nullable(),
  contactId: z.string().nullable(),
  phone: z.string().min(1),
  message: z.string().min(1),
  vendor: smsVendorSchema,
  vendorMessageId: z.string().nullable(),
  status: smsDeliveryStatusSchema,
  costCents: z.number().int().nonnegative(),
  errorMessage: z.string().nullable(),
  sentAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const smsCampaignsRecordSchema = z.union([
  smsCampaignsContactSchema,
  smsCampaignsContactGroupSchema,
  smsCampaignsTemplateSchema,
  smsCampaignsProviderConfigSchema,
  smsCampaignsCampaignSchema,
  smsCampaignsCampaignRecipientSchema,
  smsCampaignsDeliveryLogSchema
]);
