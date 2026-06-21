export interface SmsCampaignsConfig {
  enabled: boolean;
  defaultVendor?: SmsVendor;
  maxBatchSize?: number;
}

export type SmsVendor = "clicksend" | "twilio" | "sns" | "memory";
export type SmsCampaignStatus = "draft" | "scheduled" | "sending" | "completed" | "failed" | "cancelled";
export type SmsSendType = "immediate" | "scheduled";
export type SmsRecipientStatus = "pending" | "queued" | "sent" | "delivered" | "failed" | "skipped";
export type SmsDeliveryStatus = "queued" | "sent" | "delivered" | "failed";
export type SmsCampaignsIdPrefix = "smsct" | "smsgrp" | "smstpl" | "smsprov" | "smscamp" | "smsrec" | "smslog";
export type SmsCampaignsIdFactory = (prefix: SmsCampaignsIdPrefix) => string;

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface SmsContact {
  id: string;
  tenantId: string;
  phone: string;
  name: string;
  email: string | null;
  tags: string[];
  optIn: boolean;
  optInDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface SmsContactGroup {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface SmsTemplate {
  id: string;
  tenantId: string;
  name: string;
  content: string;
  charCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface SmsProviderConfig {
  id: string;
  tenantId: string;
  vendor: SmsVendor;
  isDefault: boolean;
  isEnabled: boolean;
  apiKeyRef: string | null;
  senderId: string;
  quotaLimit: number | null;
  quotaUsed: number;
  quotaResetAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmsCampaign {
  id: string;
  tenantId: string;
  name: string;
  templateId: string | null;
  vendor: SmsVendor;
  status: SmsCampaignStatus;
  sendType: SmsSendType;
  scheduledAt: string | null;
  message: string;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
  totalCostCents: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  createdBy: string | null;
}

export interface SmsCampaignRecipient {
  id: string;
  tenantId: string;
  campaignId: string;
  contactId: string;
  phone: string;
  status: SmsRecipientStatus;
  vendorMessageId: string | null;
  costCents: number;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmsDeliveryLog {
  id: string;
  tenantId: string;
  campaignId: string | null;
  recipientId: string | null;
  contactId: string | null;
  phone: string;
  message: string;
  vendor: SmsVendor;
  vendorMessageId: string | null;
  status: SmsDeliveryStatus;
  costCents: number;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSmsContactInput {
  id?: string;
  phone: string;
  name: string;
  email?: string | null;
  tags?: string[];
  optIn?: boolean;
  optInDate?: string | null;
}

export interface CreateSmsGroupInput {
  name: string;
  description?: string | null;
  contactIds?: string[];
}

export interface CreateSmsTemplateInput {
  name: string;
  content: string;
}

export interface ConfigureSmsProviderInput {
  vendor: SmsVendor;
  isDefault?: boolean;
  isEnabled?: boolean;
  apiKeyRef?: string | null;
  senderId: string;
  quotaLimit?: number | null;
  quotaResetAt?: string | null;
}

export interface CreateSmsCampaignInput {
  name: string;
  templateId?: string | null;
  message?: string | null;
  vendor: SmsVendor;
  sendType: SmsSendType;
  scheduledAt?: string | null;
  contactIds?: string[];
  groupIds?: string[];
}

export interface ScheduleSmsCampaignInput {
  campaignId: string;
  scheduledAt: string;
}

export interface DispatchSmsCampaignInput {
  campaignId: string;
  batchSize?: number;
}

export interface RecordSmsDeliveryInput {
  vendor: SmsVendor;
  vendorMessageId: string;
  status: SmsDeliveryStatus;
  costCents?: number;
  errorMessage?: string | null;
  deliveredAt?: string | null;
}

export interface SmsCampaignReport {
  campaign: SmsCampaign;
  recipients: SmsCampaignRecipient[];
  logs: SmsDeliveryLog[];
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type SmsCampaignsRecord =
  | SmsContact
  | SmsContactGroup
  | SmsTemplate
  | SmsProviderConfig
  | SmsCampaign
  | SmsCampaignRecipient
  | SmsDeliveryLog;
