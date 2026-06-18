import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { resolvePermissions } from "@microservices-sh/org-team-rbac";
import { loadWorkspaceContext } from "$lib/server/org-context";
import { buildNav } from "$lib/server/erp-nav";
import { seedDemoData } from "$lib/server/demo";

// Membership gate for the whole /app/* tree. A signed-in user with no operator
// workspace org is sent to one-time setup; otherwise we resolve the operator workspace org and the user's
// effective permissions once, for child routes and the sidebar to reuse. The
// sidebar entries are derived from the installed module set.
export const load: LayoutServerLoad = async ({ locals, cookies, platform }) => {
  if (!locals.user) throw redirect(303, "/login");

  const { org } = await loadWorkspaceContext(cookies, locals.user.id, locals.rbacStore);
  const nav = buildNav({ superAdmin: locals.user.isSuperAdmin });

  const user = { email: locals.user.email, isSuperAdmin: locals.user.isSuperAdmin };

  // No workspace yet → straight into one-time setup. Sending the user here (rather
  // than rendering an intermediate "set up your workspace" card under /app) means
  // any /app/* URL a not-yet-set-up employee lands on takes them to the wizard.
  if (!org) throw redirect(303, "/signup");

  // Local dev (no D1/R2): seed demo data scoped to this operator workspace org so the
  // dashboard is not empty. Idempotent (seedDemoData guards once per session);
  // skipped entirely in production where bindings exist.
  if (!platform?.env?.DB) {
    await seedDemoData({
      tenantId: org.id,
      customerRepository: locals.customerRepository,
      ticketStore: locals.ticketStore,
      invoiceStore: locals.invoiceStore,
      numberAllocator: locals.numberAllocator,
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
