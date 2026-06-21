import type { PageServerLoad } from "./$types";
import { listEvents } from "@microservices-sh/audit-log";
import { listCustomers } from "@microservices-sh/customer";
import { relativeTime, humanizeEvent } from "$lib/format";
import type { Tone } from "$lib/ui/types";

// Real, module-scoped tool surface keyed by the nav destination each module
// exposes. Reads run freely; writes are the ones an approval gate would hold.
// This is the actual public use-case surface of the modules — not invented.
const CATALOG: Record<string, { reads: string[]; writes: string[] }> = {
  "/app/customers": { reads: ["customer.list", "customer.get"], writes: ["customer.upsert"] },
  "/app/invoices": { reads: ["invoice.list"], writes: ["invoice.issue", "invoice.recordPayment"] },
  "/app/payments": { reads: ["payment.list"], writes: ["payment.refund"] },
  "/app/billing": { reads: ["subscription.list"], writes: ["subscription.update"] },
  "/app/bookings": { reads: ["booking.list", "booking.availability"], writes: ["booking.create", "booking.cancel"] },
  "/app/support": { reads: ["ticket.list", "ticket.get"], writes: ["ticket.update"] },
  "/app/notifications": { reads: ["notification.list"], writes: ["notification.send"] },
  "/app/images": { reads: ["image.list"], writes: ["image.generate"] },
  "/app/ads": { reads: ["ads.insights"], writes: ["ads.publish"] },
  "/app/forms": { reads: ["form.list"], writes: ["form.submit"] },
  "/app/jobs": { reads: ["job.list"], writes: ["job.enqueue"] },
  "/app/webhooks": { reads: ["webhook.list"], writes: ["webhook.deliver"] },
  "/app/files": { reads: ["file.list"], writes: ["file.upload", "file.delete"] },
  "/app/settings/team": { reads: ["member.list"], writes: ["member.invite"] }
};

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
