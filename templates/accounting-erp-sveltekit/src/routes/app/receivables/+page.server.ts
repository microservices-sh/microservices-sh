import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { createAccountsReceivableMemoryService, getAccountsReceivableModuleStatus } from "@microservices-sh/accounts-receivable";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("accounts-receivable", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = createAccountsReceivableMemoryService();
  const ctx = { tenantId: activeOrgId, now: "2026-06-21T00:00:00.000Z" };
  service.upsertInvoiceSnapshot(ctx, {
    id: "ar-demo-1001",
    customerId: "cust-demo-1",
    invoiceNumber: "INV-1001",
    issuedAt: "2026-05-20T00:00:00.000Z",
    dueDate: "2026-06-19T00:00:00.000Z",
    totalCents: 180000,
    amountPaidCents: 50000,
    amountDueCents: 130000,
    status: "open"
  });
  service.upsertInvoiceSnapshot(ctx, {
    id: "ar-demo-1002",
    customerId: "cust-demo-2",
    invoiceNumber: "INV-1002",
    issuedAt: "2026-06-10T00:00:00.000Z",
    dueDate: "2026-07-10T00:00:00.000Z",
    totalCents: 72500,
    amountPaidCents: 0,
    amountDueCents: 72500,
    status: "open"
  });
  const receivables = service.listOpenReceivables(ctx);
  const aging = service.getReceivableAging(ctx, "2026-06-21T00:00:00.000Z");

  return {
    status: getAccountsReceivableModuleStatus(),
    receivables: receivables.ok ? receivables.data : [],
    aging: aging.ok ? aging.data : null
  };
};
