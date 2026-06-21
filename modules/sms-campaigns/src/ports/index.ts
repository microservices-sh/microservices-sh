import type {
  SmsCampaign,
  SmsCampaignRecipient,
  SmsContact,
  SmsContactGroup,
  SmsDeliveryLog,
  SmsDeliveryStatus,
  SmsProviderConfig,
  SmsTemplate,
  SmsVendor
} from "../types";

export interface SmsContactListFilter {
  groupId?: string;
  optIn?: boolean;
}

export interface SmsCampaignListFilter {
  status?: SmsCampaign["status"];
  dueAt?: string;
  limit?: number;
}

export interface SmsCampaignsStore {
  getContact(tenantId: string, contactId: string): Promise<SmsContact | null>;
  findContactByPhone(tenantId: string, phone: string): Promise<SmsContact | null>;
  listContacts(tenantId: string, filter?: SmsContactListFilter): Promise<SmsContact[]>;
  upsertContact(contact: SmsContact): Promise<void>;

  getGroup(tenantId: string, groupId: string): Promise<SmsContactGroup | null>;
  createGroup(group: SmsContactGroup): Promise<void>;
  listGroups(tenantId: string): Promise<SmsContactGroup[]>;
  setGroupContacts(tenantId: string, groupId: string, contactIds: string[]): Promise<void>;
  listGroupContactIds(tenantId: string, groupId: string): Promise<string[]>;

  getTemplate(tenantId: string, templateId: string): Promise<SmsTemplate | null>;
  createTemplate(template: SmsTemplate): Promise<void>;
  listTemplates(tenantId: string): Promise<SmsTemplate[]>;

  getProviderConfig(tenantId: string, vendor: SmsVendor): Promise<SmsProviderConfig | null>;
  upsertProviderConfig(config: SmsProviderConfig): Promise<void>;
  listProviderConfigs(tenantId: string): Promise<SmsProviderConfig[]>;

  getCampaign(tenantId: string, campaignId: string): Promise<SmsCampaign | null>;
  insertCampaign(campaign: SmsCampaign): Promise<void>;
  updateCampaign(campaign: SmsCampaign): Promise<void>;
  listCampaigns(tenantId: string, filter?: SmsCampaignListFilter): Promise<SmsCampaign[]>;

  insertRecipients(recipients: SmsCampaignRecipient[]): Promise<void>;
  updateRecipient(recipient: SmsCampaignRecipient): Promise<void>;
  listRecipients(tenantId: string, campaignId: string): Promise<SmsCampaignRecipient[]>;

  getDeliveryLogByVendorMessageId(tenantId: string, vendor: SmsVendor, vendorMessageId: string): Promise<SmsDeliveryLog | null>;
  insertDeliveryLog(log: SmsDeliveryLog): Promise<void>;
  updateDeliveryLog(log: SmsDeliveryLog): Promise<void>;
  listDeliveryLogs(tenantId: string, campaignId: string): Promise<SmsDeliveryLog[]>;

  withTransaction?<T>(operation: (transactionStore: SmsCampaignsStore) => Promise<T>): Promise<T>;
}

export interface SmsProviderSendInput {
  tenantId: string;
  campaignId: string;
  recipientId: string;
  to: string;
  message: string;
  senderId: string;
  vendor: SmsVendor;
}

export interface SmsProviderSendResult {
  vendorMessageId: string;
  status?: SmsDeliveryStatus;
  costCents?: number;
}

export interface SmsProvider {
  sendMessage(input: SmsProviderSendInput): Promise<SmsProviderSendResult>;
}
