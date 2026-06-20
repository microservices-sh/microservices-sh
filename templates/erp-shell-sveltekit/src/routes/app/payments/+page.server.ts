import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listPayments } from "@microservices-sh/payment";
import { listCustomers } from "@microservices-sh/customer";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/payment. Payments are recorded by the
// checkout/webhook flow (createPaymentIntent + handleWebhook); this page is the
// admin ledger: view payments. Single company → no tenant filter; payments carry
// a customerId we resolve to a name for display. Refunds happen on the payment
// detail page (/app/payments/[id]).
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
      id: p.id,
      customer: nameById.get(p.customerId) ?? p.customerId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      description: p.description,
      createdAt: p.createdAt
    }))
  };
};
