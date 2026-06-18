import { ok, err } from "@microservices-sh/connection-contract";
import { updateOrganizationInputSchema } from "../schemas";
import { orgTeamRbacMeta } from "../meta";
import type { RbacStore } from "../ports";
import type { DomainEvent, Organization } from "../types";

// Rename an org and/or change its slug. The slug stays unique per install, so a
// collision with a DIFFERENT org is rejected; re-saving the org's own slug is a
// no-op clash. Emits org.updated. Framework-neutral: no SvelteKit/Hono imports.
export async function updateOrganization(
  input: unknown,
  deps: { store: RbacStore; now?: () => number; correlationId?: string }
) {
  const meta = orgTeamRbacMeta(deps);

  const parsed = updateOrganizationInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "org-team-rbac.INVALID_ORG_INPUT", message: "Organization input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const org = await deps.store.getOrg(parsed.data.orgId);
  if (!org) {
    return err(404, { code: "org-team-rbac.ORG_NOT_FOUND", message: "Organization not found." }, meta);
  }

  if (parsed.data.slug !== org.slug) {
    const clash = await deps.store.getOrgBySlug(parsed.data.slug);
    if (clash && clash.id !== org.id) {
      return err(409, { code: "org-team-rbac.SLUG_TAKEN", message: `Slug ${parsed.data.slug} is already in use.` }, meta);
    }
  }

  const updated: Organization = {
    ...org,
    name: parsed.data.name,
    slug: parsed.data.slug,
    updatedAt: new Date(deps.now?.() ?? Date.now()).toISOString()
  };
  await deps.store.updateOrg(updated);

  const event: DomainEvent = {
    name: "org.updated",
    correlationId: meta.correlationId,
    payload: { orgId: org.id, name: updated.name, slug: updated.slug }
  };

  return ok(200, { id: org.id, name: updated.name, slug: updated.slug, event }, meta);
}
