type ProviderStatus = "ready" | "partial" | "missing";

type Env = NonNullable<App.Platform["env"]>;

export interface SecretReadiness {
  name: string;
  envName: string;
  configured: boolean;
  purpose: string;
}

export interface ProviderHealth {
  id: string;
  label: string;
  status: ProviderStatus;
  mode: string;
  summary: string;
  callbackUrl: string | null;
  secrets: SecretReadiness[];
  details: { label: string; value: string; ok: boolean }[];
}

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function statusFrom(flags: boolean[]): ProviderStatus {
  if (flags.every(Boolean)) return "ready";
  if (flags.some(Boolean)) return "partial";
  return "missing";
}

function absoluteUrl(baseUrl: URL, path: string): string {
  return new URL(path, baseUrl).toString();
}

export function getStripeProviderHealth(
  env: Env | undefined,
  baseUrl: URL,
  options: { stripeDepositAccountId?: string | null } = {}
): ProviderHealth {
  const secretReady = configured(env?.STRIPE_SECRET_KEY);
  const webhookReady = configured(env?.STRIPE_WEBHOOK_SECRET);
  const depositReady = configured(options.stripeDepositAccountId ?? undefined);
  const status = statusFrom([secretReady, webhookReady]);

  return {
    id: "stripe",
    label: "Stripe",
    status,
    mode: secretReady ? "Stripe provider" : "memory fallback",
    summary: secretReady ? "Payment links and payment gateway calls use Stripe." : "Payments use the memory provider until Stripe secrets are configured.",
    callbackUrl: absoluteUrl(baseUrl, "/api/payments/stripe-webhook"),
    secrets: [
      { name: "Secret key", envName: "STRIPE_SECRET_KEY", configured: secretReady, purpose: "Payment links and gateway calls" },
      { name: "Webhook secret", envName: "STRIPE_WEBHOOK_SECRET", configured: webhookReady, purpose: "Signed payment settlement webhook" }
    ],
    details: [
      { label: "Payment link provider", value: secretReady ? "Stripe" : "Memory", ok: secretReady },
      { label: "Webhook verification", value: webhookReady ? "Configured" : "Missing", ok: webhookReady },
      { label: "Stripe deposit account", value: depositReady ? "Configured" : "Not selected", ok: depositReady }
    ]
  };
}

export function getEmailProviderHealth(env: Env | undefined): ProviderHealth {
  const resendReady = configured(env?.RESEND_API_KEY);
  const fromReady = configured(env?.EMAIL_FROM);
  const status = resendReady ? statusFrom([resendReady, fromReady]) : "missing";

  return {
    id: "email",
    label: "Email",
    status,
    mode: resendReady ? "Resend provider" : "console fallback",
    summary: resendReady ? "Transactional email sends use the configured provider." : "Email sends are logged through the local console provider.",
    callbackUrl: null,
    secrets: [
      { name: "Provider API key", envName: "RESEND_API_KEY", configured: resendReady, purpose: "Transactional email provider" },
      { name: "Sender address", envName: "EMAIL_FROM", configured: fromReady, purpose: "Default sender address" }
    ],
    details: [
      { label: "Email provider", value: resendReady ? "Resend" : "Console", ok: resendReady },
      { label: "Sender address", value: fromReady ? "Configured" : "Using default", ok: fromReady }
    ]
  };
}
