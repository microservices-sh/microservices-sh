import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { createAccount, listAccounts } from "@microservices-sh/accounting-core";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function accountType(value: string) {
  return ["asset", "liability", "equity", "revenue", "expense"].includes(value) ? value : null;
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("accounting-core", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const accountsResult = await listAccounts(
    { tenantId: activeOrgId, includeInactive: true, limit: 500 },
    { accountingCoreStore: locals.accountingCoreStore }
  );

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    accounts: accountsResult.ok ? accountsResult.data.accounts : []
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, platform }) => {
    requireModule("accounting-core", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      code: text(form.get("code")),
      name: text(form.get("name")),
      type: text(form.get("type")),
      description: text(form.get("description"))
    };
    const type = accountType(values.type);
    if (!values.code || !values.name || !type) return fail(400, { error: "Enter account code, name, and type.", values });

    const result = await createAccount(
      {
        tenantId: org.id,
        code: values.code,
        name: values.name,
        type,
        description: values.description || null,
        active: true
      },
      {
        accountingCoreStore: locals.accountingCoreStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "accounting-core.account_created",
        actorId: locals.user.id,
        entityType: "account",
        entityId: result.data.account.id,
        source: "app/ledger",
        payload: { code: result.data.account.code, type: result.data.account.type }
      },
      { auditStore: locals.auditStore }
    );

    return { created: true };
  }
};
