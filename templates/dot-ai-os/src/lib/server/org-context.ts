import { redirect, type Cookies } from "@sveltejs/kit";
import { authorize, resolvePermissions } from "@microservices-sh/org-team-rbac";
import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { Organization } from "@microservices-sh/org-team-rbac";

// ── Single-workspace shell ──────────────────────────────────────────────────
//
// DOT AI OS assumes one operator workspace org.
// There is no org switcher: the active org is simply the org the signed-in
// employee belongs to. We still re-validate membership against the RBAC store on
// every request — the cookie only remembers WHICH org, never grants access.

const WORKSPACE_ORG_COOKIE = "dot_ai_org";

const cookieOptions = { path: "/", httpOnly: true, sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 30 };

export function rememberWorkspaceOrg(cookies: Cookies, orgId: string): void {
  cookies.set(WORKSPACE_ORG_COOKIE, orgId, cookieOptions);
}

export function readWorkspaceOrgId(cookies: Cookies): string | null {
  return cookies.get(WORKSPACE_ORG_COOKIE) ?? null;
}

export interface WorkspaceContext {
  org: Organization | null;
}

// Resolve the single operator workspace org the user is an active member of. The remembered
// org id is re-validated against the store; a stale/removed membership yields a
// null org (the shell routes the user to setup or onboarding).
export async function loadWorkspaceContext(
  cookies: Cookies,
  userId: string,
  store: RbacStore
): Promise<WorkspaceContext> {
  const orgId = readWorkspaceOrgId(cookies);
  if (!orgId) return { org: null };

  const membership = await store.getMembership(orgId, userId);
  if (!membership || membership.status !== "active") return { org: null };

  const org = await store.getOrg(orgId);
  return { org: org ?? null };
}

export interface OrgGuardResult {
  org: Organization;
  permissions: string[];
}

// The gate for every /app/* route: require an active workspace membership AND the
// given permission. Redirects to /app when the org is wrong, otherwise resolves
// the user's effective permissions in the operator workspace org. Aliased as
// `requireOrgPermission` for the operational routes that read it.
export async function requireOrgPermission(
  cookies: Cookies,
  userId: string,
  orgId: string,
  permission: string,
  store: RbacStore
): Promise<OrgGuardResult> {
  const org = await store.getOrg(orgId);
  if (!org) throw redirect(303, "/app");

  const decision = await authorize(orgId, userId, permission, { store });
  if (!decision.ok) {
    throw redirect(303, "/app");
  }
  const permissions = await resolvePermissions(orgId, userId, { store });
  return { org, permissions };
}
