export type EmailProviderId = "resend" | (string & {});

export type EmailDeliveryStatus = "queued" | "sent" | "failed";

export interface Actor {
  id: string;
  email?: string;
  isAdmin?: boolean;
}

export interface EmailConfig {
  enabled: boolean;
  provider: "resend";
  defaultFrom: string | null;
  apiBaseUrl: string;
  userAgent: string;
  testMode: boolean;
  redactRecipientsInEvents: boolean;
}

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailAttachment {
  filename: string;
  content?: string;
  path?: string;
}

export interface EmailTemplateReference {
  id: string;
  variables?: Record<string, string | number>;
}

export interface SendEmailInput {
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
  tags?: EmailTag[];
  template?: EmailTemplateReference;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailDelivery {
  id: string;
  provider: EmailProviderId;
  providerMessageId: string | null;
  status: EmailDeliveryStatus;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailProviderSendResult {
  provider: EmailProviderId;
  providerMessageId: string | null;
  status: EmailDeliveryStatus;
  raw?: unknown;
}

export interface EmailProviderError {
  code: string;
  message: string;
  provider: EmailProviderId;
  status?: number;
  raw?: unknown;
}

export type EmailProviderResult =
  | { ok: true; data: EmailProviderSendResult }
  | { ok: false; status: number; error: EmailProviderError };

export interface DomainEvent {
  eventName: "email.queued" | "email.sent" | "email.failed";
  entityType: "email";
  entityId: string;
  payload: Record<string, unknown>;
}

export interface ModuleError {
  code: string;
  message: string;
  issues?: unknown;
}

export type ModuleResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ModuleError };
