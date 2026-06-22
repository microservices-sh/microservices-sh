import type { CommerceConnection, SyncRun, WebhookReceipt } from "@microservices-sh/commerce-sync";

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

export interface WooCommerceConnectionHealth {
  id: string;
  name: string;
  baseUrl: string | null;
  active: boolean;
  credentialsConfigured: boolean;
  credentialSource: string;
  webhookUrl: string;
  latestRun: SyncRun | null;
  latestWebhook: WebhookReceipt | null;
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

function envSecret(env: Env | undefined, key: string): string {
  return ((env ?? {}) as Record<string, string | undefined>)[key]?.trim() ?? "";
}

function credentialSource(secretRef: string): string {
  const ref = secretRef.trim();
  if (ref.startsWith("{")) return "inline JSON";
  if (ref.startsWith("env:")) return ref.slice(4).trim();
  return ref || "WOOCOMMERCE_CREDENTIALS_JSON";
}

export function resolveWooCommerceCredentialsJson(connection: CommerceConnection, env: Env | undefined): string {
  const ref = connection.secretRef.trim();
  if (ref.startsWith("{")) return ref;
  const envKey = ref.startsWith("env:") ? ref.slice(4).trim() : ref;
  return envSecret(env, envKey) || envSecret(env, "WOOCOMMERCE_CREDENTIALS_JSON");
}

export function getStripeProviderHealth(env: Env | undefined, baseUrl: URL): ProviderHealth {
  const secretReady = configured(env?.STRIPE_SECRET_KEY);
  const webhookReady = configured(env?.STRIPE_WEBHOOK_SECRET);
  const status = statusFrom([secretReady, webhookReady]);

  return {
    id: "stripe",
    label: "Stripe",
    status,
    mode: secretReady ? "Stripe provider" : "memory fallback",
    summary: secretReady ? "Invoice payment links and payment gateway calls use Stripe." : "Payments use the memory provider until Stripe secrets are configured.",
    callbackUrl: absoluteUrl(baseUrl, "/api/payments/stripe-webhook"),
    secrets: [
      { name: "Secret key", envName: "STRIPE_SECRET_KEY", configured: secretReady, purpose: "Payment links and gateway calls" },
      { name: "Webhook secret", envName: "STRIPE_WEBHOOK_SECRET", configured: webhookReady, purpose: "Signed invoice payment webhook" }
    ],
    details: [
      { label: "Payment link provider", value: secretReady ? "Stripe" : "Memory", ok: secretReady },
      { label: "Webhook verification", value: webhookReady ? "Configured" : "Missing", ok: webhookReady }
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

export function getWooCommerceProviderHealth(
  env: Env | undefined,
  baseUrl: URL,
  tenantId: string,
  connections: CommerceConnection[],
  runs: SyncRun[],
  receipts: WebhookReceipt[]
): { provider: ProviderHealth; connections: WooCommerceConnectionHealth[] } {
  const webhookReady = configured(env?.WOOCOMMERCE_WEBHOOK_SECRET);
  const wooConnections = connections.filter((connection) => connection.provider === "woocommerce");
  const connectionHealth = wooConnections.map((connection) => {
    const credentialsConfigured = configured(resolveWooCommerceCredentialsJson(connection, env));
    return {
      id: connection.id,
      name: connection.name,
      baseUrl: connection.baseUrl ?? null,
      active: connection.active,
      credentialsConfigured,
      credentialSource: credentialSource(connection.secretRef),
      webhookUrl: absoluteUrl(baseUrl, `/api/commerce-sync/woocommerce/${tenantId}/${connection.id}`),
      latestRun: runs.find((run) => run.connectionId === connection.id) ?? null,
      latestWebhook: receipts.find((receipt) => receipt.connectionId === connection.id) ?? null
    };
  });
  const hasActiveConnection = connectionHealth.some((connection) => connection.active && connection.baseUrl);
  const hasCredentials = connectionHealth.some((connection) => connection.active && connection.credentialsConfigured);
  const status = statusFrom([hasActiveConnection, hasCredentials, webhookReady]);

  return {
    provider: {
      id: "woocommerce",
      label: "WooCommerce",
      status,
      mode: hasActiveConnection ? "provider connection" : "not connected",
      summary: hasActiveConnection
        ? "WooCommerce sync and signed order webhooks use configured commerce-sync connections."
        : "Create an active WooCommerce connection before running sync or receiving order webhooks.",
      callbackUrl: connectionHealth[0]?.webhookUrl ?? null,
      secrets: [
        { name: "REST credentials", envName: "WOOCOMMERCE_CREDENTIALS_JSON", configured: hasCredentials, purpose: "WooCommerce REST API credentials" },
        { name: "Webhook secret", envName: "WOOCOMMERCE_WEBHOOK_SECRET", configured: webhookReady, purpose: "Signed WooCommerce order webhooks" }
      ],
      details: [
        { label: "Active connections", value: String(connectionHealth.filter((connection) => connection.active).length), ok: hasActiveConnection },
        { label: "REST credentials", value: hasCredentials ? "Configured" : "Missing", ok: hasCredentials },
        { label: "Webhook verification", value: webhookReady ? "Configured" : "Missing", ok: webhookReady }
      ]
    },
    connections: connectionHealth
  };
}

export function sanitizeProviderMessage(message: string): string {
  return message.replace(/consumer_(key|secret)=[^&\s]+/gi, "consumer_$1=redacted").replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic redacted");
}
