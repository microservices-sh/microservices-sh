// Email provider/repository selection. Console provider by default so dev works
// with no keys; Resend when RESEND_API_KEY is set. Repository is D1-backed in
// production, in-memory locally. Mirrors the booking template's email wiring.
import type { EmailProvider, EmailRepository } from "@microservices-sh/email/ports";
import { createMemoryEmailRepository } from "@microservices-sh/email/adapters/memory";
import { createD1EmailRepository } from "@microservices-sh/email/adapters/d1";
import { createResendEmailProvider } from "@microservices-sh/email/adapters/resend";

function createConsoleEmailProvider(): EmailProvider {
  return {
    id: "console",
    async sendEmail(input) {
      console.log(`[email:console] to=${input.to.join(",")} subject=${JSON.stringify(input.subject)}`);
      return {
        ok: true,
        // "console" isn't a real EmailProviderId — the dev provider only logs.
        data: {
          provider: "console" as never,
          providerMessageId: `console_${crypto.randomUUID().slice(0, 8)}`,
          status: "sent"
        }
      };
    }
  };
}

export interface EmailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export function getEmailDeps(
  d1: D1Database | undefined,
  env: EmailEnv | undefined
): { provider: EmailProvider; emailRepository: EmailRepository; from: string } {
  const emailRepository = d1 ? createD1EmailRepository(d1) : createMemoryEmailRepository();
  const provider = env?.RESEND_API_KEY
    ? createResendEmailProvider({ apiKey: env.RESEND_API_KEY })
    : createConsoleEmailProvider();
  return { provider, emailRepository, from: env?.EMAIL_FROM ?? "no-reply@example.com" };
}
