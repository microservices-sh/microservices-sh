import type { RequestEvent } from "@sveltejs/kit";

type RuntimeErrorOptions = {
  status?: number;
  message?: string;
  // Request-scoped context, supplied additively by hooks. All optional — when
  // absent reportRuntimeError behaves exactly as before.
  requestId?: string | null;
  tenantId?: string | null;
  actorId?: string | null;
};

type ObservabilityEnv = {
  MICROSERVICES_DEPLOYMENT_ID?: string;
  MICROSERVICES_OBSERVABILITY_TOKEN?: string;
  MICROSERVICES_OBSERVABILITY_URL?: string;
  MICROSERVICES_TEMPLATE_ID?: string;
  MICROSERVICES_WORKER_NAME?: string;
};

// Minimal structural shape of a Workers Analytics Engine binding. Kept local and
// duck-typed so the sink is a pure capability check (no-op when the binding is
// absent) without depending on the global type being present at this call site.
type AnalyticsSink = {
  writeDataPoint: (event: {
    blobs?: (string | null)[];
    doubles?: number[];
    indexes?: string[];
  }) => void;
};

// Optional Analytics Engine binding name. Absent in every existing deployment,
// so this stays a no-op until an operator binds it in wrangler.toml.
type AnalyticsEnv = {
  OBSERVABILITY?: AnalyticsSink;
};

export type RequestLog = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  tenantId?: string | null;
  actorId?: string | null;
};

// Generate a per-request id. Prefer the platform's crypto.randomUUID (available
// on Workers and modern Node); fall back to a timestamp+random token so this is
// safe in any runtime without a new dependency.
export function generateRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// One structured JSON line per request. No-op-safe: always logs to console (no
// binding required) and, when an Analytics Engine dataset is bound, additionally
// writes a single data point. Never throws.
export function logRequest(log: RequestLog, platform?: App.Platform): void {
  try {
    console.log(
      JSON.stringify({
        source: "request",
        level: "info",
        eventType: "http.request",
        requestId: log.requestId,
        method: log.method,
        path: log.path,
        status: log.status,
        durationMs: log.durationMs,
        tenantId: log.tenantId ?? null,
        actorId: log.actorId ?? null
      })
    );
  } catch {
    // Never let logging break a request.
  }

  writeAnalyticsDataPoint(platform, log);
}

// Optional Workers Analytics Engine sink. Pure capability check — does nothing
// when no OBSERVABILITY binding is present. Never throws.
function writeAnalyticsDataPoint(platform: App.Platform | undefined, log: RequestLog): void {
  const dataset = (platform?.env as AnalyticsEnv | undefined)?.OBSERVABILITY;
  if (!dataset || typeof dataset.writeDataPoint !== "function") return;

  try {
    dataset.writeDataPoint({
      // High-cardinality dimensions as blobs; indexed by tenant for sampling.
      blobs: [log.method, log.path, String(log.status), log.tenantId ?? null, log.actorId ?? null, log.requestId],
      doubles: [log.durationMs, log.status],
      indexes: [log.tenantId ?? "unknown"]
    });
  } catch {
    // Analytics is best-effort; never surface failures.
  }
}

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
      // Prefer the request id threaded from the request hook (correlates with the
      // http.request log line); fall back to cf-ray when not supplied.
      requestId: options.requestId ?? event.request.headers.get("cf-ray"),
      traceId: traceId(event),
      route: event.route.id ?? "unknown",
      statusCode: options.status ?? 500,
      metadata: {
        errorName: errorName(error),
        method: event.request.method,
        templateId: env.MICROSERVICES_TEMPLATE_ID ?? null,
        tenantId: options.tenantId ?? null,
        actorId: options.actorId ?? null
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
