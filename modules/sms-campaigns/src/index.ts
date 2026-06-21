export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  smsCampaignsCampaignRecipientSchema,
  smsCampaignsCampaignSchema,
  smsCampaignsConfigSchema,
  smsCampaignsContactGroupSchema,
  smsCampaignsContactSchema,
  smsCampaignsDeliveryLogSchema,
  smsCampaignsProviderConfigSchema,
  smsCampaignsRecordSchema,
  smsCampaignsTemplateSchema
} from "./schemas";
export { defaultSmsCampaignsHooks } from "./hooks";
export { events as smsCampaignsEvents } from "./events";
export { permissions as smsCampaignsPermissions } from "./permissions";
export { resources as smsCampaignsResources } from "./resources";
export {
  createSequentialSmsCampaignsIdFactory,
  createSmsCampaignsService,
  getSmsCampaignsModuleStatus
} from "./service";
export { createD1SmsCampaignsStore } from "./adapters/d1";
export { createSmsCampaignsMemoryStore } from "./adapters/memory";
export type { SmsCampaignsHooks } from "./hooks";
export type { SmsCampaignListFilter, SmsCampaignsStore, SmsContactListFilter, SmsProvider, SmsProviderSendInput, SmsProviderSendResult } from "./ports";
export type { SmsCampaignsMemoryStoreState } from "./adapters/memory";
export type { SmsCampaignsService, SmsCampaignsServiceDeps } from "./service";
export type {
  ConfigureSmsProviderInput,
  CreateSmsCampaignInput,
  CreateSmsGroupInput,
  CreateSmsTemplateInput,
  DispatchSmsCampaignInput,
  ModuleResult,
  RecordSmsDeliveryInput,
  ScheduleSmsCampaignInput,
  SmsCampaign,
  SmsCampaignRecipient,
  SmsCampaignReport,
  SmsCampaignStatus,
  SmsCampaignsConfig,
  SmsCampaignsIdFactory,
  SmsCampaignsIdPrefix,
  SmsCampaignsRecord,
  SmsContact,
  SmsContactGroup,
  SmsDeliveryLog,
  SmsDeliveryStatus,
  SmsProviderConfig,
  SmsRecipientStatus,
  SmsSendType,
  SmsTemplate,
  SmsVendor,
  TenantContext,
  UpsertSmsContactInput
} from "./types";

export const smsCampaignsModule = {
  id: "sms-campaigns",
  version: "0.1.0"
} as const;
