import type { RequestEvent } from "@sveltejs/kit";

type RuntimeErrorOptions = {
  status?: number;
  message?: string;
};

type ObservabilityEnv = {
  MICROSERVICES_DEPLOYMENT_ID?: string;
  MICROSERVICES_OBSERVABILITY_TOKEN?: string;
  MICROSERVICES_OBSERVABILITY_URL?: string;
  MICROSERVICES_TEMPLATE_ID?: string;
  MICROSERVICES_WORKER_NAME?: string;
};

function text(value: unknown, fallback = "Unknown error") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 1_000) : fallback;
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "Error";
}

function errorMessage(error: unknown, fallback?: string) {
  if (error instanceof Error) return text(error.message, fallback ?? "Runtime error");
  return text(fallback, "Runtime error");
}

function traceId(event: RequestEvent) {
  const traceparent = event.request.headers.get("traceparent");
  const parts = traceparent?.split("-");
  return parts?.length === 4 ? parts[1] : null;
}

function endpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/observability/events`;
}

async function sendRuntimeError(env: ObservabilityEnv, error: unknown, event: RequestEvent, options: RuntimeErrorOptions) {
  if (!env.MICROSERVICES_DEPLOYMENT_ID || !env.MICROSERVICES_OBSERVABILITY_TOKEN || !env.MICROSERVICES_OBSERVABILITY_URL) {
    return;
  }

  await fetch(endpoint(env.MICROSERVICES_OBSERVABILITY_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MICROSERVICES_OBSERVABILITY_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deploymentId: env.MICROSERVICES_DEPLOYMENT_ID,
      workerName: env.MICROSERVICES_WORKER_NAME ?? env.MICROSERVICES_TEMPLATE_ID,
      source: "runtime",
      level: "error",
      eventType: "runtime.exception",
      message: errorMessage(error, options.message),
      requestId: event.request.headers.get("cf-ray"),
      traceId: traceId(event),
      route: event.route.id ?? "unknown",
      statusCode: options.status ?? 500,
      metadata: {
        errorName: errorName(error),
        method: event.request.method,
        templateId: env.MICROSERVICES_TEMPLATE_ID ?? null
      }
    })
  }).catch(() => undefined);
}

export function reportRuntimeError(error: unknown, event: RequestEvent, options: RuntimeErrorOptions = {}) {
  const env = event.platform?.env as ObservabilityEnv | undefined;
  if (!env) return;

  const report = sendRuntimeError(env, error, event, options);
  event.platform?.context?.waitUntil(report);
}
