import type { SmsCampaignListFilter, SmsCampaignsStore, SmsContactListFilter } from "../ports";
import type {
  SmsCampaign,
  SmsCampaignRecipient,
  SmsContact,
  SmsContactGroup,
  SmsDeliveryLog,
  SmsProviderConfig,
  SmsTemplate,
  SmsVendor
} from "../types";

export interface SmsCampaignsMemoryStoreState {
  contacts?: SmsContact[];
  groups?: SmsContactGroup[];
  groupContacts?: Array<{ tenantId: string; groupId: string; contactId: string }>;
  templates?: SmsTemplate[];
  providerConfigs?: SmsProviderConfig[];
  campaigns?: SmsCampaign[];
  recipients?: SmsCampaignRecipient[];
  deliveryLogs?: SmsDeliveryLog[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function tenantKey(tenantId: string, id: string): string {
  return `${tenantId}:${id}`;
}

function vendorKey(tenantId: string, vendor: SmsVendor): string {
  return `${tenantId}:${vendor}`;
}

function deliveryKey(tenantId: string, vendor: SmsVendor, vendorMessageId: string): string {
  return `${tenantId}:${vendor}:${vendorMessageId}`;
}

function matchesContactFilter(contact: SmsContact, filter?: SmsContactListFilter): boolean {
  return filter?.optIn == null || contact.optIn === filter.optIn;
}

function matchesCampaignFilter(campaign: SmsCampaign, filter?: SmsCampaignListFilter): boolean {
  if (filter?.status && campaign.status !== filter.status) return false;
  if (filter?.dueAt && campaign.scheduledAt && Date.parse(campaign.scheduledAt) > Date.parse(filter.dueAt)) return false;
  if (filter?.dueAt && !campaign.scheduledAt) return false;
  return true;
}

export function createSmsCampaignsMemoryStore(initialState: SmsCampaignsMemoryStoreState = {}): SmsCampaignsStore {
  const contacts = new Map<string, SmsContact>();
  const contactPhoneIndex = new Map<string, string>();
  const groups = new Map<string, SmsContactGroup>();
  const groupContacts = new Map<string, Set<string>>();
  const templates = new Map<string, SmsTemplate>();
  const providerConfigs = new Map<string, SmsProviderConfig>();
  const campaigns = new Map<string, SmsCampaign>();
  const recipients = new Map<string, SmsCampaignRecipient>();
  const deliveryLogs = new Map<string, SmsDeliveryLog>();
  const deliveryLogsByVendorMessage = new Map<string, string>();

  for (const contact of initialState.contacts ?? []) {
    contacts.set(contact.id, copy(contact));
    contactPhoneIndex.set(tenantKey(contact.tenantId, contact.phone), contact.id);
  }
  for (const group of initialState.groups ?? []) groups.set(group.id, copy(group));
  for (const membership of initialState.groupContacts ?? []) {
    const key = tenantKey(membership.tenantId, membership.groupId);
    const set = groupContacts.get(key) ?? new Set<string>();
    set.add(membership.contactId);
    groupContacts.set(key, set);
  }
  for (const template of initialState.templates ?? []) templates.set(template.id, copy(template));
  for (const config of initialState.providerConfigs ?? []) providerConfigs.set(vendorKey(config.tenantId, config.vendor), copy(config));
  for (const campaign of initialState.campaigns ?? []) campaigns.set(campaign.id, copy(campaign));
  for (const recipient of initialState.recipients ?? []) recipients.set(recipient.id, copy(recipient));
  for (const log of initialState.deliveryLogs ?? []) {
    deliveryLogs.set(log.id, copy(log));
    if (log.vendorMessageId) deliveryLogsByVendorMessage.set(deliveryKey(log.tenantId, log.vendor, log.vendorMessageId), log.id);
  }

  const store: SmsCampaignsStore = {
    async getContact(tenantId, contactId) {
      const contact = contacts.get(contactId);
      return contact?.tenantId === tenantId ? copy(contact) : null;
    },

    async findContactByPhone(tenantId, phone) {
      const contactId = contactPhoneIndex.get(tenantKey(tenantId, phone));
      const contact = contactId ? contacts.get(contactId) : null;
      return contact ? copy(contact) : null;
    },

    async listContacts(tenantId, filter) {
      const allowedIds = filter?.groupId ? groupContacts.get(tenantKey(tenantId, filter.groupId)) : null;
      return [...contacts.values()]
        .filter((contact) => contact.tenantId === tenantId && matchesContactFilter(contact, filter) && (!allowedIds || allowedIds.has(contact.id)))
        .map(copy);
    },

    async upsertContact(contact) {
      contacts.set(contact.id, copy(contact));
      contactPhoneIndex.set(tenantKey(contact.tenantId, contact.phone), contact.id);
    },

    async getGroup(tenantId, groupId) {
      const group = groups.get(groupId);
      return group?.tenantId === tenantId ? copy(group) : null;
    },

    async createGroup(group) {
      groups.set(group.id, copy(group));
    },

    async listGroups(tenantId) {
      return [...groups.values()].filter((group) => group.tenantId === tenantId).map(copy);
    },

    async setGroupContacts(tenantId, groupId, contactIds) {
      groupContacts.set(tenantKey(tenantId, groupId), new Set(contactIds));
    },

    async listGroupContactIds(tenantId, groupId) {
      return [...(groupContacts.get(tenantKey(tenantId, groupId)) ?? new Set<string>())];
    },

    async getTemplate(tenantId, templateId) {
      const template = templates.get(templateId);
      return template?.tenantId === tenantId ? copy(template) : null;
    },

    async createTemplate(template) {
      templates.set(template.id, copy(template));
    },

    async listTemplates(tenantId) {
      return [...templates.values()].filter((template) => template.tenantId === tenantId).map(copy);
    },

    async getProviderConfig(tenantId, vendor) {
      const config = providerConfigs.get(vendorKey(tenantId, vendor));
      return config ? copy(config) : null;
    },

    async upsertProviderConfig(config) {
      if (config.isDefault) {
        for (const existing of providerConfigs.values()) {
          if (existing.tenantId === config.tenantId && existing.vendor !== config.vendor && existing.isDefault) {
            providerConfigs.set(vendorKey(existing.tenantId, existing.vendor), { ...existing, isDefault: false, updatedAt: config.updatedAt });
          }
        }
      }
      providerConfigs.set(vendorKey(config.tenantId, config.vendor), copy(config));
    },

    async listProviderConfigs(tenantId) {
      return [...providerConfigs.values()].filter((config) => config.tenantId === tenantId).map(copy);
    },

    async getCampaign(tenantId, campaignId) {
      const campaign = campaigns.get(campaignId);
      return campaign?.tenantId === tenantId ? copy(campaign) : null;
    },

    async insertCampaign(campaign) {
      campaigns.set(campaign.id, copy(campaign));
    },

    async updateCampaign(campaign) {
      campaigns.set(campaign.id, copy(campaign));
    },

    async listCampaigns(tenantId, filter) {
      const rows = [...campaigns.values()]
        .filter((campaign) => campaign.tenantId === tenantId && matchesCampaignFilter(campaign, filter))
        .sort((a, b) => (a.scheduledAt ?? a.createdAt).localeCompare(b.scheduledAt ?? b.createdAt));
      return rows.slice(0, filter?.limit ?? rows.length).map(copy);
    },

    async insertRecipients(newRecipients) {
      for (const recipient of newRecipients) recipients.set(recipient.id, copy(recipient));
    },

    async updateRecipient(recipient) {
      recipients.set(recipient.id, copy(recipient));
    },

    async listRecipients(tenantId, campaignId) {
      return [...recipients.values()]
        .filter((recipient) => recipient.tenantId === tenantId && recipient.campaignId === campaignId)
        .map(copy);
    },

    async getDeliveryLogByVendorMessageId(tenantId, vendor, vendorMessageId) {
      const logId = deliveryLogsByVendorMessage.get(deliveryKey(tenantId, vendor, vendorMessageId));
      const log = logId ? deliveryLogs.get(logId) : null;
      return log ? copy(log) : null;
    },

    async insertDeliveryLog(log) {
      deliveryLogs.set(log.id, copy(log));
      if (log.vendorMessageId) deliveryLogsByVendorMessage.set(deliveryKey(log.tenantId, log.vendor, log.vendorMessageId), log.id);
    },

    async updateDeliveryLog(log) {
      deliveryLogs.set(log.id, copy(log));
      if (log.vendorMessageId) deliveryLogsByVendorMessage.set(deliveryKey(log.tenantId, log.vendor, log.vendorMessageId), log.id);
    },

    async listDeliveryLogs(tenantId, campaignId) {
      return [...deliveryLogs.values()]
        .filter((log) => log.tenantId === tenantId && log.campaignId === campaignId)
        .map(copy);
    },

    async withTransaction(operation) {
      const snapshots = {
        contacts: new Map(contacts),
        contactPhoneIndex: new Map(contactPhoneIndex),
        groups: new Map(groups),
        groupContacts: new Map([...groupContacts].map(([key, value]) => [key, new Set(value)])),
        templates: new Map(templates),
        providerConfigs: new Map(providerConfigs),
        campaigns: new Map(campaigns),
        recipients: new Map(recipients),
        deliveryLogs: new Map(deliveryLogs),
        deliveryLogsByVendorMessage: new Map(deliveryLogsByVendorMessage)
      };
      try {
        return await operation(store);
      } catch (error) {
        contacts.clear();
        contactPhoneIndex.clear();
        groups.clear();
        groupContacts.clear();
        templates.clear();
        providerConfigs.clear();
        campaigns.clear();
        recipients.clear();
        deliveryLogs.clear();
        deliveryLogsByVendorMessage.clear();
        for (const [key, value] of snapshots.contacts) contacts.set(key, value);
        for (const [key, value] of snapshots.contactPhoneIndex) contactPhoneIndex.set(key, value);
        for (const [key, value] of snapshots.groups) groups.set(key, value);
        for (const [key, value] of snapshots.groupContacts) groupContacts.set(key, value);
        for (const [key, value] of snapshots.templates) templates.set(key, value);
        for (const [key, value] of snapshots.providerConfigs) providerConfigs.set(key, value);
        for (const [key, value] of snapshots.campaigns) campaigns.set(key, value);
        for (const [key, value] of snapshots.recipients) recipients.set(key, value);
        for (const [key, value] of snapshots.deliveryLogs) deliveryLogs.set(key, value);
        for (const [key, value] of snapshots.deliveryLogsByVendorMessage) deliveryLogsByVendorMessage.set(key, value);
        throw error;
      }
    }
  };

  return store;
}
