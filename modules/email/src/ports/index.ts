import type { DomainEvent, EmailDelivery, EmailProviderResult, SendEmailInput } from "../types";

export interface EmailProvider {
  id: string;
  sendEmail(input: SendEmailInput): Promise<EmailProviderResult>;
}

export interface EmailRepository {
  recordDelivery(delivery: EmailDelivery): Promise<void>;
  getDelivery(id: string): Promise<EmailDelivery | null>;
  listDeliveries(input?: { limit?: number; recipient?: string }): Promise<EmailDelivery[]>;
  writeEvent(event: DomainEvent): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  create(prefix: string): string;
}
