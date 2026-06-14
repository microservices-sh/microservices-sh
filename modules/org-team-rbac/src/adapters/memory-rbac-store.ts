import type { RbacStore } from "../ports";
import type { Invitation, Membership, Organization, Role } from "../types";

export function createMemoryRbacStore(): RbacStore {
  const orgs = new Map<string, Organization>();
  const roles = new Map<string, Role>();
  const memberships = new Map<string, Membership>(); // key: `${orgId}:${userId}`
  const invitations = new Map<string, Invitation>(); // key: token

  const mkey = (orgId: string, userId: string) => `${orgId}:${userId}`;

  return {
    async insertOrg(org) {
      orgs.set(org.id, { ...org });
    },
    async getOrg(id) {
      const o = orgs.get(id);
      return o ? { ...o } : null;
    },
    async getOrgBySlug(slug) {
      for (const o of orgs.values()) if (o.slug === slug) return { ...o };
      return null;
    },
    async updateOrg(org) {
      if (orgs.has(org.id)) orgs.set(org.id, { ...org });
    },

    async insertRole(role) {
      roles.set(role.id, { ...role, permissions: [...role.permissions] });
    },
    async getRole(id) {
      const r = roles.get(id);
      return r ? { ...r, permissions: [...r.permissions] } : null;
    },
    async listRoles(orgId) {
      return [...roles.values()].filter((r) => r.orgId === orgId).map((r) => ({ ...r, permissions: [...r.permissions] }));
    },

    async insertMembership(m) {
      memberships.set(mkey(m.orgId, m.userId), { ...m });
    },
    async getMembership(orgId, userId) {
      const m = memberships.get(mkey(orgId, userId));
      return m ? { ...m } : null;
    },
    async listMemberships(orgId) {
      return [...memberships.values()].filter((m) => m.orgId === orgId).map((m) => ({ ...m }));
    },
    async updateMembership(m) {
      memberships.set(mkey(m.orgId, m.userId), { ...m });
    },
    async countOwners(orgId) {
      let n = 0;
      for (const m of memberships.values()) {
        if (m.orgId !== orgId || m.status !== "active") continue;
        const role = roles.get(m.roleId);
        if (role?.permissions.includes("*")) n += 1;
      }
      return n;
    },

    async insertInvitation(inv) {
      invitations.set(inv.token, { ...inv });
    },
    async getInvitationByToken(token) {
      const inv = invitations.get(token);
      return inv ? { ...inv } : null;
    },
    async updateInvitation(inv) {
      if (invitations.has(inv.token)) invitations.set(inv.token, { ...inv });
    },
    async listInvitations(orgId) {
      return [...invitations.values()].filter((inv) => inv.orgId === orgId).map((inv) => ({ ...inv }));
    }
  };
}
