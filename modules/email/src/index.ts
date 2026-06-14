export { manifest, moduleDefinition } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { emailConfigSchema, emailDeliverySchema, sendEmailInputSchema } from "./schemas";
export { defaultEmailHooks } from "./hooks";
export { emailEvents } from "./events";
export { emailPermissions } from "./permissions";
export { emailResources } from "./resources";
export { sendEmail } from "./use-cases/send-email";
export type { EmailProvider, EmailRepository } from "./ports";
export type {
  Actor,
  DomainEvent,
  EmailAttachment,
  EmailConfig,
  EmailDelivery,
  EmailDeliveryStatus,
  EmailProviderError,
  EmailProviderId,
  EmailProviderResult,
  EmailProviderSendResult,
  EmailTag,
  EmailTemplateReference,
  ModuleResult,
  SendEmailInput
} from "./types";

export const emailModule = {
  id: "email",
  version: "0.1.0"
} as const;
