import type { PageServerLoad } from "./$types";
import { listMembers } from "@microservices-sh/org-team-rbac";
import { listCustomers } from "@microservices-sh/customer";
import { listInvoices } from "@microservices-sh/invoice";
import { listTickets } from "@microservices-sh/support-ticket";
import { listEvents } from "@microservices-sh/audit-log";
import { listNotifications } from "@microservices-sh/notifications-inapp";
import { money, relativeTime, humanizeEvent } from "$lib/format";
import type { Tone } from "$lib/ui/types";

const eventTone = (eventName: string): Tone => {
  if (eventName.includes("payment")) return "good";
  if (eventName.includes("issued") || eventName.includes("created")) return "info";
  if (eventName.includes("overdue") || eventName.includes("failed")) return "bad";
  if (eventName.includes("ticket")) return "warn";
  return "neutral";
};

export const load: PageServerLoad = async ({ locals, parent }) => {
  // The /app layout guarantees a signed-in user with an active company org.
  const { activeOrg } = await parent();
  const activeOrgId = activeOrg.id;
  const now = Date.now();

  // Operations command center: every panel is a thin read over a module use case,
  // joined in-memory by customer id / email so the page tells one story.
  // The /app layout guarantees locals.user, so notifications scope to it directly.
  const userId = locals.user!.id;
  const [members, customers, invoices, tickets, events, notifications] = await Promise.all([
    listMembers(activeOrgId, { store: locals.rbacStore }),
    listCustomers({ customerRepository: locals.customerRepository }),
    listInvoices({ tenantId: activeOrgId }, { invoiceStore: locals.invoiceStore }),
    listTickets({ tenantId: activeOrgId }, { store: locals.ticketStore }),
    listEvents({ limit: 8 }, { auditStore: locals.auditStore }),
    listNotifications(
      { userId, unreadOnly: true, limit: 5 },
      { store: locals.notificationStore }
    )
  ]);

  const invoiceList = invoices.ok && invoices.data ? invoices.data.invoices : [];
  const customerList = customers.data.customers;
  const ticketList = tickets.ok && tickets.data ? tickets.data.tickets : [];
  const eventList = events.ok ? events.data.events : [];
  const unread = notifications.ok && notifications.data ? notifications.data.notifications : [];

  const nameById = new Map(customerList.map((c) => [c.id, c.name]));
  const currency = invoiceList[0]?.currency ?? "USD";

  const open = invoiceList.filter((i) => i.status === "open");
  const overdue = open
    .filter((i) => i.dueAt && new Date(i.dueAt).getTime() < now)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
  const outstandingCents = open.reduce((t, i) => t + (i.totalCents - i.amountPaidCents), 0);
  const overdueCents = overdue.reduce((t, i) => t + (i.totalCents - i.amountPaidCents), 0);
  const collectedCents = invoiceList.reduce((t, i) => t + i.amountPaidCents, 0);

  const openTickets = ticketList
    .filter((t) => t.status === "open" || t.status === "pending")
    .sort((a, b) => Number(b.priority === "high" || b.priority === "urgent") - Number(a.priority === "high" || a.priority === "urgent"));

  return {
    metrics: {
      outstanding: money(outstandingCents, currency),
      outstandingOpenCount: open.length,
      overdueCount: overdue.length,
      overdueAmount: money(overdueCents, currency),
      collected: money(collectedCents, currency),
      openTicketCount: openTickets.length,
      customerCount: customerList.length,
      memberCount: members.data.count,
      unreadCount: unread.length
    },
    overdue: overdue.slice(0, 5).map((i) => ({
      id: i.id,
      number: i.number ?? "—",
      customerId: i.customerId,
      customerName: nameById.get(i.customerId) ?? "Unknown customer",
      balance: money(i.totalCents - i.amountPaidCents, i.currency),
      due: relativeTime(i.dueAt, now)
    })),
    tickets: openTickets.slice(0, 5).map((t) => ({
      id: t.id,
      subject: t.subject,
      requesterEmail: t.requesterEmail,
      priority: t.priority,
      age: relativeTime(t.createdAt, now)
    })),
    activity: eventList.map((e) => {
      const subject =
        e.entityType === "customer" && e.entityId ? nameById.get(e.entityId) : undefined;
      return {
        title: humanizeEvent(e.eventName),
        detail: subject ?? (typeof e.payload?.requesterEmail === "string" ? e.payload.requesterEmail : undefined),
        time: relativeTime(e.createdAt, now),
        tone: eventTone(e.eventName)
      };
    }),
    notifications: unread.map((n) => ({
      id: n.id,
      title: n.title ?? humanizeEvent(n.type),
      body: n.body ?? "",
      time: relativeTime(n.createdAt, now)
    }))
  };
};
