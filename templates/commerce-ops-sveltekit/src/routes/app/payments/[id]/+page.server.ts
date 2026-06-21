import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { listPayments, refundPayment } from "@microservices-sh/payment";
import { getCustomer } from "@microservices-sh/customer";
import { listEvents, recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { money, relativeTime, humanizeEvent } from "$lib/format";
import type { Tone } from "$lib/ui/types";

const statusTone = (s: string): Tone =>
  s === "succeeded" || s === "paid" ? "good" : s === "refunded" ? "neutral" : s === "failed" ? "bad" : "warn";

const eventTone = (e: string): Tone => {
  if (e.includes("refunded")) return "neutral";
  if (e.includes("failed")) return "bad";
  if (e.includes("succeeded") || e.includes("captured") || e.includes("created")) return "info";
  return "neutral";
};

// There's no single-payment use case wired into the ledger read path; resolve by
// id from the same list the ledger uses (no tenant filter — single company).
async function findPayment(id: string, repo: App.Locals["paymentRepository"]) {
  const res = await listPayments({}, { paymentRepository: repo });
  return res.ok && res.data ? res.data.payments.find((p) => p.id === id) : undefined;
}

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("payment", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const canManage = permissions.includes("*") || permissions.includes("member.manage");
  const now = Date.now();

  const [payment, eventsResult] = await Promise.all([
    findPayment(params.id, locals.paymentRepository),
    listEvents({ entityType: "payment", entityId: params.id, limit: 20 }, { auditStore: locals.auditStore })
  ]);
  if (!payment) throw error(404, "Payment not found");

  let customerName: string | null = null;
  if (payment.customerId) {
    const cust = await getCustomer({ id: payment.customerId }, { customerRepository: locals.customerRepository });
    customerName = cust.ok && cust.data ? cust.data.customer.name : payment.customerId;
  }
  const events = eventsResult.ok ? eventsResult.data.events : [];

  return {
    canManage,
    payment: {
      id: payment.id,
      reference: payment.intentId,
      status: payment.status,
      tone: statusTone(payment.status),
      refundable: payment.status !== "refunded",
      customerId: payment.customerId || null,
      customerName,
      currency: payment.currency,
      amount: money(payment.amount, payment.currency),
      description: payment.description,
      created: payment.createdAt ? relativeTime(payment.createdAt, now) : null
    },
    timeline: events.map((e) => ({
      title: humanizeEvent(e.eventName),
      detail:
        typeof e.payload?.amountCents === "number"
          ? money(e.payload.amountCents as number, payment.currency)
          : undefined,
      time: relativeTime(e.createdAt, now),
      tone: eventTone(e.eventName)
    }))
  };
};

export const actions: Actions = {
  // Refund this payment: resolve it by id to get the gateway intent id, ask the
  // gateway to refund, then mark the record refunded (409 if already refunded).
  // member.manage-gated.
  refund: async ({ params, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const activeOrgId = org.id;

    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

    const payment = await findPayment(params.id, locals.paymentRepository);
    if (!payment) return fail(404, { error: "Payment not found." });

    const result = await refundPayment(
      { intentId: payment.intentId },
      { paymentRepository: locals.paymentRepository, paymentGateway: locals.paymentGateway }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Refund failed." });

    await recordEvent(
      {
        eventName: "payment.refunded",
        actorId: locals.user.id,
        entityType: "payment",
        entityId: params.id,
        source: "app/payments/detail",
        payload: { status: result.data.payment?.status ?? "refunded" }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, refunded: true };
  }
};
