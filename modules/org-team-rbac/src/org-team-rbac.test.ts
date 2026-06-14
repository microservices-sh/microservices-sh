import { describe, it, expect } from "vitest";
import {
  createOrganization,
  inviteMember,
  acceptInvitation,
  removeMember,
  authorize,
  resolvePermissions,
  permissionMatches,
  createMemoryRbacStore
} from "./index";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

async function seedOrg() {
  const store = createMemoryRbacStore();
  const org = await createOrganization(
    { name: "Acme", slug: "acme", ownerUserId: "owner-1" },
    { store, now: fixedNow(T0) }
  );
  return { store, orgId: org.data!.id as string, roles: org.data!.roles as Record<string, string> };
}

describe("org-team-rbac: non-member authorization", () => {
  it("resolves to no permissions and authorize returns 403", async () => {
    const { store, orgId } = await seedOrg();

    const perms = await resolvePermissions(orgId, "stranger", { store });
    expect(perms).toEqual([]);

    const res = await authorize(orgId, "stranger", "org.read", { store });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(res.error?.code).toBe("FORBIDDEN");
  });
});

describe("org-team-rbac: single-use invitation", () => {
  it("fails when the same invitation is accepted twice", async () => {
    const { store, orgId, roles } = await seedOrg();

    const invite = await inviteMember(
      { orgId, email: "new@acme.test", roleId: roles.member },
      { store, now: fixedNow(T0), token: () => "tok-1" }
    );
    expect(invite.ok).toBe(true);
    const token = invite.data!.token as string;

    const first = await acceptInvitation({ token, userId: "user-2" }, { store, now: fixedNow(T0 + 1000) });
    expect(first.ok).toBe(true);
    expect(first.status).toBe(201);

    const second = await acceptInvitation({ token, userId: "user-3" }, { store, now: fixedNow(T0 + 2000) });
    expect(second.ok).toBe(false);
    expect(second.status).toBe(409);
    expect(second.error?.code).toBe("INVITATION_USED");
  });
});

describe("org-team-rbac: last owner protection", () => {
  it("cannot remove the last owner", async () => {
    const { store, orgId } = await seedOrg();

    const res = await removeMember(orgId, "owner-1", { store, now: fixedNow(T0 + 1) });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(409);
    expect(res.error?.code).toBe("LAST_OWNER");
  });
});

describe("org-team-rbac: wildcard permission matching", () => {
  it("matches with global and prefix wildcards", async () => {
    const { store, orgId } = await seedOrg();

    // Owner holds "*" -> any permission authorizes.
    const ownerPerms = await resolvePermissions(orgId, "owner-1", { store });
    expect(ownerPerms).toContain("*");
    const allowed = await authorize(orgId, "owner-1", "anything.at.all", { store });
    expect(allowed.ok).toBe(true);

    // permissionMatches unit checks.
    expect(permissionMatches("*", "billing.read")).toBe(true);
    expect(permissionMatches("billing.*", "billing.read")).toBe(true);
    expect(permissionMatches("billing.*", "org.read")).toBe(false);
    expect(permissionMatches("org.read", "org.read")).toBe(true);
    expect(permissionMatches("org.read", "org.manage")).toBe(false);
  });
});
