import type { Invitation, Membership, Organization, Role } from "../types";

// Single store for the whole module. Every membership lookup is keyed by
// (orgId, userId) so callers cannot accidentally read across tenants.
export interface RbacStore {
  insertOrg(org: Organization): Promise<void>;
  getOrg(id: string): Promise<Organization | null>;
  getOrgBySlug(slug: string): Promise<Organization | null>;
  updateOrg(org: Organization): Promise<void>;
  // True once any organization exists — lets a single-company app gate its
  // one-time first-run setup (close /signup after the company is created).
  anyOrganizationExists(): Promise<boolean>;
  // The first/only organization, or null. A single-company app uses this to
  // resolve "the company" for a signed-in user without a remembered org id.
  firstOrganization(): Promise<Organization | null>;

  insertRole(role: Role): Promise<void>;
  getRole(id: string): Promise<Role | null>;
  listRoles(orgId: string): Promise<Role[]>;

  insertMembership(membership: Membership): Promise<void>;
  getMembership(orgId: string, userId: string): Promise<Membership | null>;
  listMemberships(orgId: string): Promise<Membership[]>;
  updateMembership(membership: Membership): Promise<void>;
  // Count active memberships in an org whose role grants "*" (owners). Used to
  // refuse removing/downgrading the last owner.
  countOwners(orgId: string): Promise<number>;

  insertInvitation(invitation: Invitation): Promise<void>;
  getInvitationByToken(token: string): Promise<Invitation | null>;
  updateInvitation(invitation: Invitation): Promise<void>;
  listInvitations(orgId: string): Promise<Invitation[]>;
}
