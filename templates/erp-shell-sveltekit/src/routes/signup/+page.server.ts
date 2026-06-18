import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createOrganization, inviteMember } from "@microservices-sh/org-team-rbac";
import { recordEvent } from "@microservices-sh/audit-log";
import { writeSession, userIdForEmail, getSessionSecret } from "$lib/server/session";
import { rememberCompanyOrg, loadCompanyContext } from "$lib/server/org-context";

interface SetupInvite {
  email: string;
  role: "admin" | "member";
}

// Parse the wizard's invites payload defensively — only keep well-formed rows.
function parseInvites(raw: string): SetupInvite[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i): i is SetupInvite =>
        !!i && typeof (i as SetupInvite).email === "string" && /.+@.+\..+/.test((i as SetupInvite).email))
      .map((i) => ({ email: i.email.trim().toLowerCase(), role: i.role === "admin" ? "admin" : "member" }))
      .slice(0, 25);
  } catch {
    return [];
  }
}

// One-time company setup. In a single-company ERP this is NOT a public tenant
// funnel: it creates the one company org and makes the first user its owner.
// After setup, /app routes employees straight into the shell.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  // A signed-in employee who ALREADY belongs to a company doesn't need setup —
  // send them into the shell. But a signed-in user WITHOUT a company org is
  // exactly who this page is for: the /app onboarding CTA ("Set up the company")
  // links here. Bouncing on `locals.user` alone created a dead loop
  // (/app → /signup → redirect → /app), so only redirect when an org resolves.
  if (locals.user) {
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (org) throw redirect(303, "/app");
  }
  return {};
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export const actions: Actions = {
  default: async ({ request, cookies, locals, platform }) => {
    const formData = await request.formData();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const orgName = String(formData.get("orgName") ?? "").trim();
    const slug = slugify(String(formData.get("slug") ?? orgName));
    const values = { email, orgName, slug };

    if (!email || !email.includes("@")) {
      return fail(400, { error: "Enter a valid email address.", values });
    }
    if (!orgName) {
      return fail(400, { error: "Enter a company name.", values });
    }

    const userId = userIdForEmail(email);

    // The org-team-rbac use case creates the company org, seeds owner/admin/member
    // roles, and makes this user the owner — all in one framework-neutral call.
    const result = await createOrganization(
      { name: orgName, slug, ownerUserId: userId },
      { store: locals.rbacStore }
    );

    if (!result.ok) {
      return fail(result.status, { error: result.error?.message ?? "Could not create the company.", values });
    }

    const orgId = result.data.id;
    await recordEvent(
      { eventName: "org.created", actorId: userId, entityType: "organization", entityId: orgId, source: "setup", payload: { slug: result.data.slug } },
      { auditStore: locals.auditStore }
    );

    // Optional: send the wizard's team invitations. Resolve the seeded role ids
    // by name (admin/member). Best-effort — a bad invite never fails setup; the
    // owner can re-invite from Team. The org already exists at this point.
    const invites = parseInvites(String(formData.get("invites") ?? "[]"));
    if (invites.length > 0) {
      const roles = await locals.rbacStore.listRoles(orgId);
      const roleId = (name: string) => roles.find((r) => r.name === name)?.id;
      for (const invite of invites) {
        const rid = roleId(invite.role);
        if (!rid) continue;
        const res = await inviteMember({ orgId, email: invite.email, roleId: rid }, { store: locals.rbacStore });
        if (res.ok) {
          await recordEvent(
            { eventName: "member.invited", actorId: userId, entityType: "organization", entityId: orgId, source: "setup", payload: { invitationId: res.data.id } },
            { auditStore: locals.auditStore }
          );
        }
      }
    }

    await writeSession(cookies, { id: userId, email }, getSessionSecret(platform));
    rememberCompanyOrg(cookies, orgId);

    throw redirect(303, "/app");
  }
};
