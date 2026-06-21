import type { PageServerLoad } from "./$types";
import { listEvents } from "@microservices-sh/audit-log";
import { listCustomers } from "@microservices-sh/customer";
import { relativeTime, humanizeEvent } from "$lib/format";
import type { Tone } from "$lib/ui/types";
import lockfile from "../../../../microservices.lock.json";

type RpcEntry = {
  method?: string;
  scope?: string | null;
  mutation?: boolean;
};

type LockModule = {
  id: string;
  contract?: {
    rpc?: Array<string | RpcEntry>;
  };
};

const READ_PREFIXES = ["get", "list", "read", "find", "query", "fetch", "count", "view", "describe"];
const READ_SCOPE_SUFFIX = /\.(read|list|view|observe|verify)$/;

const MODULE_BY_HREF: Record<string, string> = {
  "/app/customers": "customer",
  "/app/products": "product-catalog",
  "/app/inventory": "inventory",
  "/app/sales-orders": "sales-order",
  "/app/shipments": "shipment",
  "/app/invoices": "invoice",
  "/app/payments": "payment",
  "/app/support": "support-ticket",
  "/app/notifications": "notifications-inapp",
  "/app/jobs": "jobs-workflows",
  "/app/webhooks": "webhook-delivery",
  "/app/files": "file-media",
  "/app/settings/team": "org-team-rbac"
};

function normalizeRpc(entry: string | RpcEntry): RpcEntry | null {
  if (typeof entry === "string") return { method: entry };
  return typeof entry.method === "string" ? entry : null;
}

function isReadTool(entry: RpcEntry): boolean {
  if (typeof entry.mutation === "boolean") return !entry.mutation;
  const method = String(entry.method ?? "").toLowerCase();
  if (READ_PREFIXES.some((prefix) => method.startsWith(prefix))) return true;
  return typeof entry.scope === "string" && READ_SCOPE_SUFFIX.test(entry.scope);
}

function toolName(moduleId: string, methodName: string): string {
  return `${moduleId}_${methodName}`;
}

function toolsForModule(moduleId: string): { reads: string[]; writes: string[] } {
  const module = ((lockfile.modules ?? []) as LockModule[]).find((m) => m.id === moduleId);
  const tools = { reads: [] as string[], writes: [] as string[] };

  for (const raw of module?.contract?.rpc ?? []) {
    const rpc = normalizeRpc(raw);
    if (!rpc?.method) continue;
    const bucket = isReadTool(rpc) ? tools.reads : tools.writes;
    bucket.push(toolName(moduleId, rpc.method));
  }

  return tools;
}

// The visible Agent Center catalog mirrors the lock-generated MCP tool names.
// Modules can still have UI routes without MCP tools; only declared lock RPCs
// appear here as callable agent capabilities.
const CATALOG: Record<string, { reads: string[]; writes: string[] }> = Object.fromEntries(
  Object.entries(MODULE_BY_HREF)
    .map(([href, moduleId]) => [href, toolsForModule(moduleId)] as const)
    .filter(([, tools]) => tools.reads.length + tools.writes.length > 0)
);

const eventTone = (eventName: string): Tone => {
  if (eventName.includes("payment")) return "good";
  if (eventName.includes("issued") || eventName.includes("created") || eventName.includes("upload")) return "info";
  if (eventName.includes("failed")) return "bad";
  if (eventName.includes("ticket")) return "warn";
  return "neutral";
};

export const load: PageServerLoad = async ({ parent, locals, platform }) => {
  const { nav, permissions } = await parent();
  const now = Date.now();

  // The action log IS the audit stream — every module write lands here with a
  // tenant, actor, entity, and outcome. That is the real "agent run history".
  const [events, customers] = await Promise.all([
    listEvents({ limit: 25 }, { auditStore: locals.auditStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  const nameById = new Map(customers.data.customers.map((c) => [c.id, c.name]));
  const eventList = events.ok ? events.data.events : [];

  // Capabilities are derived from the ENABLED module nav, so the catalog reflects
  // exactly what this workspace has turned on — disable a module and its tools
  // disappear here too.
  const capabilities = nav
    .flatMap((g) => g.items)
    .filter((i) => CATALOG[i.href])
    .map((i) => ({ label: i.label, href: i.href, ...CATALOG[i.href] }));

  const toolCount = capabilities.reduce((t, c) => t + c.reads.length + c.writes.length, 0);
  const writeCount = capabilities.reduce((t, c) => t + c.writes.length, 0);
  const canApprove = permissions.includes("*") || permissions.includes("member.manage");

  return {
    runtime: {
      mode: platform?.env?.DB ? "Connected runtime · D1 + R2" : "In-memory dev runtime",
      connected: Boolean(platform?.env?.DB)
    },
    stats: {
      moduleCount: capabilities.length,
      toolCount,
      writeCount,
      loggedCount: eventList.length
    },
    canApprove,
    capabilities,
    stream: eventList.map((e) => ({
      title: humanizeEvent(e.eventName),
      detail:
        e.entityType === "customer" && e.entityId
          ? nameById.get(e.entityId)
          : typeof e.source === "string"
            ? e.source
            : undefined,
      time: relativeTime(e.createdAt, now),
      tone: eventTone(e.eventName)
    }))
  };
};
