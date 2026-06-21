import { redirect, type Cookies } from "@sveltejs/kit";
import { authorize, resolvePermissions } from "@microservices-sh/org-team-rbac";
import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { Organization } from "@microservices-sh/org-team-rbac";

const ORGS_COOKIE = "saas_orgs";
const ACTIVE_ORG_COOKIE = "saas_active_org";

const cookieOptions = { path: "/", httpOnly: true, sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 30 };

// The RbacStore is deliberately org-scoped (no cross-tenant "list my orgs"), so
// the app shell remembers which orgs a user belongs to in a cookie, updated when
// they create or join one. Each entry is still re-validated against the store.
export function readOrgIds(cookies: Cookies): string[] {
  const raw = cookies.get(ORGS_COOKIE);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberOrg(cookies: Cookies, orgId: string): void {
  const ids = new Set(readOrgIds(cookies));
  ids.add(orgId);
  cookies.set(ORGS_COOKIE, JSON.stringify([...ids]), cookieOptions);
  cookies.set(ACTIVE_ORG_COOKIE, orgId, cookieOptions);
}

export function setActiveOrg(cookies: Cookies, orgId: string): void {
  cookies.set(ACTIVE_ORG_COOKIE, orgId, cookieOptions);
}

export interface OrgMembershipView {
  orgs: Organization[];
  activeOrgId: string | null;
}

// Resolve the orgs this user actually has an active membership in, plus the
// active org. Stale cookie ids (membership removed) are dropped.
export async function loadOrgMemberships(
  cookies: Cookies,
  userId: string,
  store: RbacStore
): Promise<OrgMembershipView> {
  const ids = readOrgIds(cookies);
  const orgs: Organization[] = [];
  for (const id of ids) {
    const membership = await store.getMembership(id, userId);
    if (!membership || membership.status !== "active") continue;
    const org = await store.getOrg(id);
    if (org) orgs.push(org);
  }
  const requested = cookies.get(ACTIVE_ORG_COOKIE);
  const activeOrgId = orgs.find((org) => org.id === requested)?.id ?? orgs[0]?.id ?? null;
  return { orgs, activeOrgId };
}

export interface OrgGuardResult {
  org: Organization;
  permissions: string[];
}

// The gate for every /app/* route: require an active org membership AND the given
// permission. Redirects to /app when the org is wrong, throws 403 otherwise.
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
