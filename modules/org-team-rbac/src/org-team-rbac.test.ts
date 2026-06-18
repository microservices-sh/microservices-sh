import { describe, it, expect } from "vitest";
import {
  createOrganization,
  updateOrganization,
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
  if (!org.ok) throw new Error("seed failed");
  return { store, orgId: org.data.id, roles: org.data.roles };
}

describe("org-team-rbac: organization rename", () => {
  it("renames + changes slug, and rejects a slug already taken by another org", async () => {
    const store = createMemoryRbacStore();
    const a = await createOrganization({ name: "Acme", slug: "acme", ownerUserId: "u1" }, { store, now: fixedNow(T0) });
    const b = await createOrganization({ name: "Beta", slug: "beta", ownerUserId: "u2" }, { store, now: fixedNow(T0) });
    if (!a.ok || !b.ok) throw new Error("seed failed");

    const renamed = await updateOrganization(
      { orgId: a.data.id, name: "Acme Inc", slug: "acme-inc" },
      { store, now: fixedNow(T0) }
    );
    expect(renamed.ok).toBe(true);
    expect(renamed.status).toBe(200);
    if (renamed.ok) {
      expect(renamed.data.name).toBe("Acme Inc");
      expect(renamed.data.slug).toBe("acme-inc");
    }
    const fetched = await store.getOrg(a.data.id);
    expect(fetched?.slug).toBe("acme-inc");

    // Re-saving the org's own (now-current) slug is allowed.
    const sameSlug = await updateOrganization(
      { orgId: a.data.id, name: "Acme Incorporated", slug: "acme-inc" },
      { store, now: fixedNow(T0) }
    );
    expect(sameSlug.ok).toBe(true);

    // Taking another org's slug is rejected.
    const clash = await updateOrganization(
      { orgId: a.data.id, name: "Acme Inc", slug: "beta" },
      { store, now: fixedNow(T0) }
    );
    expect(clash.ok).toBe(false);
    expect(clash.status).toBe(409);
    if (!clash.ok) expect(clash.error.code).toBe("org-team-rbac.SLUG_TAKEN");
  });

  it("404s for an unknown org", async () => {
    const store = createMemoryRbacStore();
    const res = await updateOrganization({ orgId: "org_missing", name: "X", slug: "x" }, { store, now: fixedNow(T0) });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });
});

describe("org-team-rbac: non-member authorization", () => {
  it("resolves to no permissions and authorize returns 403", async () => {
    const { store, orgId } = await seedOrg();

    const perms = await resolvePermissions(orgId, "stranger", { store });
    expect(perms).toEqual([]);

    const res = await authorize(orgId, "stranger", "org.read", { store });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    if (!res.ok) expect(res.error.code).toBe("org-team-rbac.FORBIDDEN");
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
    if (!invite.ok) throw new Error("invite failed");
    const token = invite.data.token;

    const first = await acceptInvitation({ token, userId: "user-2" }, { store, now: fixedNow(T0 + 1000) });
    expect(first.ok).toBe(true);
    expect(first.status).toBe(201);

    const second = await acceptInvitation({ token, userId: "user-3" }, { store, now: fixedNow(T0 + 2000) });
    expect(second.ok).toBe(false);
    expect(second.status).toBe(409);
    if (!second.ok) expect(second.error.code).toBe("org-team-rbac.INVITATION_USED");
  });
});

describe("org-team-rbac: last owner protection", () => {
  it("cannot remove the last owner", async () => {
    const { store, orgId } = await seedOrg();

    const res = await removeMember(orgId, "owner-1", { store, now: fixedNow(T0 + 1) });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(409);
    if (!res.ok) expect(res.error.code).toBe("org-team-rbac.LAST_OWNER");
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
