import type { RbacStore } from "../ports";
import type { Invitation, InvitationStatus, Membership, MembershipStatus, Organization, OrgStatus, Role } from "../types";

function toOrg(r: Record<string, unknown>): Organization {
  return { id: String(r.id), name: String(r.name), slug: String(r.slug), status: String(r.status) as OrgStatus, createdAt: String(r.created_at), updatedAt: String(r.updated_at) };
}
function toRole(r: Record<string, unknown>): Role {
  return { id: String(r.id), orgId: String(r.org_id), name: String(r.name), permissions: JSON.parse(String(r.permissions ?? "[]")) as string[] };
}
function toMembership(r: Record<string, unknown>): Membership {
  return { id: String(r.id), orgId: String(r.org_id), userId: String(r.user_id), roleId: String(r.role_id), status: String(r.status) as MembershipStatus, createdAt: String(r.created_at), updatedAt: String(r.updated_at) };
}
function toInvitation(r: Record<string, unknown>): Invitation {
  return { id: String(r.id), orgId: String(r.org_id), email: String(r.email), roleId: String(r.role_id), token: String(r.token), status: String(r.status) as InvitationStatus, expiresAt: String(r.expires_at), createdAt: String(r.created_at) };
}

export function createD1RbacStore(db: D1Database): RbacStore {
  return {
    async insertOrg(org) {
      await db.prepare("INSERT INTO organizations (id, name, slug, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(org.id, org.name, org.slug, org.status, org.createdAt, org.updatedAt).run();
    },
    async getOrg(id) {
      const r = await db.prepare("SELECT * FROM organizations WHERE id = ?").bind(id).first<Record<string, unknown>>();
      return r ? toOrg(r) : null;
    },
    async getOrgBySlug(slug) {
      const r = await db.prepare("SELECT * FROM organizations WHERE slug = ?").bind(slug).first<Record<string, unknown>>();
      return r ? toOrg(r) : null;
    },
    async updateOrg(org) {
      await db.prepare("UPDATE organizations SET name = ?, slug = ?, status = ?, updated_at = ? WHERE id = ?")
        .bind(org.name, org.slug, org.status, org.updatedAt, org.id).run();
    },
    async anyOrganizationExists() {
      const r = await db.prepare("SELECT 1 FROM organizations LIMIT 1").first();
      return r != null;
    },
    async firstOrganization() {
      const r = await db.prepare("SELECT * FROM organizations LIMIT 1").first<Record<string, unknown>>();
      return r ? toOrg(r) : null;
    },

    async insertRole(role) {
      await db.prepare("INSERT INTO roles (id, org_id, name, permissions) VALUES (?, ?, ?, ?)")
        .bind(role.id, role.orgId, role.name, JSON.stringify(role.permissions)).run();
    },
    async getRole(id) {
      const r = await db.prepare("SELECT * FROM roles WHERE id = ?").bind(id).first<Record<string, unknown>>();
      return r ? toRole(r) : null;
    },
    async listRoles(orgId) {
      const res = await db.prepare("SELECT * FROM roles WHERE org_id = ? ORDER BY name ASC").bind(orgId).all<Record<string, unknown>>();
      return (res.results ?? []).map(toRole);
    },

    async insertMembership(m) {
      await db.prepare("INSERT INTO memberships (id, org_id, user_id, role_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(m.id, m.orgId, m.userId, m.roleId, m.status, m.createdAt, m.updatedAt).run();
    },
    async getMembership(orgId, userId) {
      const r = await db.prepare("SELECT * FROM memberships WHERE org_id = ? AND user_id = ?").bind(orgId, userId).first<Record<string, unknown>>();
      return r ? toMembership(r) : null;
    },
    async listMemberships(orgId) {
      const res = await db.prepare("SELECT * FROM memberships WHERE org_id = ? ORDER BY created_at ASC").bind(orgId).all<Record<string, unknown>>();
      return (res.results ?? []).map(toMembership);
    },
    async updateMembership(m) {
      await db.prepare("UPDATE memberships SET role_id = ?, status = ?, updated_at = ? WHERE id = ?")
        .bind(m.roleId, m.status, m.updatedAt, m.id).run();
    },
    async countOwners(orgId) {
      const r = await db.prepare(
        `SELECT COUNT(*) AS n FROM memberships m JOIN roles r ON m.role_id = r.id
         WHERE m.org_id = ? AND m.status = 'active' AND r.permissions LIKE '%"*"%'`
      ).bind(orgId).first<{ n: number }>();
      return Number(r?.n ?? 0);
    },

    async insertInvitation(inv) {
      await db.prepare("INSERT INTO invitations (id, org_id, email, role_id, token, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(inv.id, inv.orgId, inv.email, inv.roleId, inv.token, inv.status, inv.expiresAt, inv.createdAt).run();
    },
    async getInvitationByToken(token) {
      const r = await db.prepare("SELECT * FROM invitations WHERE token = ?").bind(token).first<Record<string, unknown>>();
      return r ? toInvitation(r) : null;
    },
    async updateInvitation(inv) {
      await db.prepare("UPDATE invitations SET status = ? WHERE id = ?").bind(inv.status, inv.id).run();
    },
    async listInvitations(orgId) {
      const res = await db.prepare("SELECT * FROM invitations WHERE org_id = ? ORDER BY created_at DESC").bind(orgId).all<Record<string, unknown>>();
      return (res.results ?? []).map(toInvitation);
    }
  };
}
