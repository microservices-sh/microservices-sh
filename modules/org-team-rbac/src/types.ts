export type OrgStatus = "active" | "suspended";
export type MembershipStatus = "active" | "removed";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  // org-scoped role. (System defaults are created per org at creation time.)
  orgId: string;
  name: string;
  permissions: string[];
}

export interface Membership {
  id: string;
  orgId: string;
  userId: string;
  roleId: string;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  roleId: string;
  token: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

// The acting principal for an authorization check.
export interface RbacActor {
  userId: string;
}
