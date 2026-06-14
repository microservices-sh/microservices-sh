import type { EmailDelivery, SendEmailInput } from "./types";

export interface EmailHooks {
  beforeEmailSend?: (input: SendEmailInput) => Promise<SendEmailInput> | SendEmailInput;
  afterEmailQueued?: (input: { delivery: EmailDelivery; email: SendEmailInput }) => Promise<void> | void;
  afterEmailFailed?: (input: { delivery: EmailDelivery; email: SendEmailInput }) => Promise<void> | void;
}

export const defaultEmailHooks: Required<EmailHooks> = {
  beforeEmailSend(input) {
    return input;
  },
  afterEmailQueued() {
    return undefined;
  },
  afterEmailFailed() {
    return undefined;
  }
};
