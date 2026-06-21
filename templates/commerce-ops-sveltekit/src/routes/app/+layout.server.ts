import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { resolvePermissions } from "@microservices-sh/org-team-rbac";
import { loadCompanyContext } from "$lib/server/org-context";
import { buildNav } from "$lib/server/erp-nav";
import { seedDemoData } from "$lib/server/demo";

// Membership gate for the whole /app/* tree. A signed-in user with no company org
// is sent to one-time setup; otherwise we resolve the company org and the user's
// effective permissions once, for child routes and the sidebar to reuse. The
// sidebar entries are derived from the installed module set (erp-nav).
export const load: LayoutServerLoad = async ({ locals, cookies, platform }) => {
  if (!locals.user) throw redirect(303, "/login");

  const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
  const nav = buildNav({ superAdmin: locals.user.isSuperAdmin, platform });

  const user = { email: locals.user.email, isSuperAdmin: locals.user.isSuperAdmin };

  // No active company membership. If the company has not been bootstrapped yet,
  // send the user to first-run setup. If a company already exists, this signed-in
  // account is simply not invited; route back to login so the page can explain
  // the access problem instead of bouncing /app → /signup → /login forever.
  if (!org) {
    if (await locals.rbacStore.anyOrganizationExists()) throw redirect(303, "/login?reason=no-company-access");
    throw redirect(303, "/signup");
  }

  // Local dev (no D1/R2): seed demo data scoped to this company org so the
  // dashboard is not empty. Idempotent (seedDemoData guards once per session);
  // skipped entirely in production where bindings exist.
  if (!platform?.env?.DB) {
    await seedDemoData({
      tenantId: org.id,
      customerRepository: locals.customerRepository,
      ticketStore: locals.ticketStore,
      invoiceStore: locals.invoiceStore,
      numberAllocator: locals.numberAllocator,
      productCatalogStore: locals.productCatalogStore,
      inventoryStore: locals.inventoryStore,
      salesOrderStore: locals.salesOrderStore,
      commerceSyncService: locals.commerceSyncService,
      mediaStore: locals.mediaStore,
      objectStorage: locals.objectStorage,
      auditStore: locals.auditStore
    });
  }

  const permissions = await resolvePermissions(org.id, locals.user.id, { store: locals.rbacStore });

  return {
    activeOrgId: org.id,
    activeOrg: { id: org.id, name: org.name, slug: org.slug },
    permissions,
    nav,
    user
  };
};
