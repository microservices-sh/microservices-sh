import { defaultConfig, configSchema } from "../config";
import { defaultEmailHooks, type EmailHooks } from "../hooks";
import { sendEmailInputSchema } from "../schemas";
import type { Clock, EmailProvider, EmailRepository, IdGenerator } from "../ports";
import type { Actor, EmailDelivery, EmailProviderResult, ModuleResult, SendEmailInput } from "../types";

const defaultClock: Clock = {
  now: () => new Date()
};

const defaultIdGenerator: IdGenerator = {
  create: (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
};

function deliveryPayload(input: SendEmailInput, redacted: boolean) {
  return {
    subject: input.subject,
    to: redacted ? input.to.length : input.to,
    cc: redacted ? input.cc?.length ?? 0 : input.cc ?? [],
    bcc: redacted ? input.bcc?.length ?? 0 : input.bcc ?? [],
    idempotencyKey: input.idempotencyKey ?? null,
    tags: input.tags ?? [],
    metadata: input.metadata ?? {}
  };
}

function createDelivery(input: {
  id: string;
  email: SendEmailInput;
  providerResult: EmailProviderResult;
  createdAt: string;
}): EmailDelivery {
  const { id, email, providerResult, createdAt } = input;
  const failed = !providerResult.ok;

  return {
    id,
    provider: providerResult.ok ? providerResult.data.provider : providerResult.error.provider,
    providerMessageId: providerResult.ok ? providerResult.data.providerMessageId : null,
    status: providerResult.ok ? providerResult.data.status : "failed",
    fromAddress: email.from ?? "",
    toAddresses: email.to,
    ccAddresses: email.cc ?? [],
    bccAddresses: email.bcc ?? [],
    subject: email.subject,
    idempotencyKey: email.idempotencyKey ?? null,
    metadata: email.metadata ?? {},
    errorCode: failed ? providerResult.error.code : null,
    errorMessage: failed ? providerResult.error.message : null,
    createdAt,
    updatedAt: createdAt
  };
}

export async function sendEmail(
  input: unknown,
  deps: {
    provider: EmailProvider;
    emailRepository?: EmailRepository;
    config?: Partial<typeof defaultConfig>;
    hooks?: EmailHooks;
    actor?: Actor | null;
    clock?: Clock;
    idGenerator?: IdGenerator;
  }
): Promise<ModuleResult<{ delivery: EmailDelivery }>> {
  const configResult = configSchema.safeParse({ ...defaultConfig, ...deps.config });
  if (!configResult.success) {
    return {
      ok: false,
      status: 500,
      error: {
        code: "INVALID_EMAIL_CONFIG",
        message: "Email module configuration is invalid.",
        issues: configResult.error.issues
      }
    };
  }

  const config = configResult.data;
  if (!config.enabled) {
    return {
      ok: false,
      status: 503,
      error: {
        code: "EMAIL_DISABLED",
        message: "Email sending is disabled by module configuration."
      }
    };
  }

  const parsed = sendEmailInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_EMAIL_INPUT",
        message: "Email input is invalid.",
        issues: parsed.error.issues
      }
    };
  }

  const from = parsed.data.from ?? config.defaultFrom;
  if (!from) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "MISSING_EMAIL_FROM",
        message: "Email input must include from, or config.defaultFrom must be set."
      }
    };
  }

  const hooks = { ...defaultEmailHooks, ...deps.hooks };
  const prepared = await hooks.beforeEmailSend({ ...parsed.data, from });
  const preparedParsed = sendEmailInputSchema.safeParse(prepared);
  if (!preparedParsed.success || !preparedParsed.data.from) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_EMAIL_AFTER_HOOK",
        message: "beforeEmailSend returned invalid email input.",
        issues: preparedParsed.success ? undefined : preparedParsed.error.issues
      }
    };
  }

  const clock = deps.clock ?? defaultClock;
  const idGenerator = deps.idGenerator ?? defaultIdGenerator;
  const deliveryId = idGenerator.create("eml");
  const createdAt = clock.now().toISOString();
  const result = config.testMode
    ? ({
        ok: true,
        data: {
          provider: deps.provider.id,
          providerMessageId: `test_${deliveryId}`,
          status: "queued",
          raw: { testMode: true }
        }
      } as const)
    : await deps.provider.sendEmail(preparedParsed.data);

  const delivery = createDelivery({
    id: deliveryId,
    email: preparedParsed.data,
    providerResult: result,
    createdAt
  });

  await deps.emailRepository?.recordDelivery(delivery);
  await deps.emailRepository?.writeEvent({
    eventName: delivery.status === "failed" ? "email.failed" : "email.queued",
    entityType: "email",
    entityId: delivery.id,
    payload: {
      actorId: deps.actor?.id ?? null,
      provider: delivery.provider,
      providerMessageId: delivery.providerMessageId,
      status: delivery.status,
      ...deliveryPayload(preparedParsed.data, config.redactRecipientsInEvents)
    }
  });

  if (delivery.status === "failed") {
    await hooks.afterEmailFailed({ delivery, email: preparedParsed.data });
    return {
      ok: false,
      status: result.ok ? 502 : result.status,
      error: {
        code: delivery.errorCode ?? "EMAIL_SEND_FAILED",
        message: delivery.errorMessage ?? "Email provider failed to send the message."
      }
    };
  }

  await hooks.afterEmailQueued({ delivery, email: preparedParsed.data });
  return {
    ok: true,
    status: 202,
    data: { delivery }
  };
}
