import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listPayments, refundPayment } from "@microservices-sh/payment";
import { listCustomers } from "@microservices-sh/customer";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/payment. Payments are recorded by the
// checkout/webhook flow (createPaymentIntent + handleWebhook); this page is the
// admin ledger: view payments and issue refunds. Single company → no tenant
// filter; payments carry a customerId we resolve to a name for display.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("payment", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const [payments, customersResult] = await Promise.all([
    listPayments({}, { paymentRepository: locals.paymentRepository }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);
  const nameById = new Map(customersResult.data.customers.map((c) => [c.id, c.name]));
  const rows = payments.ok ? payments.data.payments : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    payments: rows.map((p) => ({
      intentId: p.intentId,
      customer: nameById.get(p.customerId) ?? p.customerId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      description: p.description,
      createdAt: p.createdAt
    }))
  };
};

export const actions: Actions = {
  // Refund a payment by intent id: the use-case asks the gateway to refund, then
  // marks the record refunded (409 if already refunded). member.manage-gated.
  refund: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const activeOrgId = org.id;

    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

    const intentId = String((await request.formData()).get("intentId") ?? "").trim();
    if (!intentId) return fail(400, { error: "Missing payment." });

    const result = await refundPayment(
      { intentId },
      { paymentRepository: locals.paymentRepository, paymentGateway: locals.paymentGateway }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Refund failed." });

    await recordEvent(
      {
        eventName: "payment.refunded",
        actorId: locals.user.id,
        entityType: "payment",
        entityId: intentId,
        source: "app/payments",
        payload: { status: result.data.payment.status }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, refunded: true };
  }
};
