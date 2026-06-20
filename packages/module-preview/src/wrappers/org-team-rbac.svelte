<script lang="ts">
  // Interactive wrapper for the org-team-rbac module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real use
  // cases: inviteMember (member.invited), acceptInvitation (member.joined),
  // updateMemberRole (role.updated), removeMember (member.removed). Roles use the
  // module's DEFAULT_ROLES seed; the Preview's authorize check uses the real
  // wildcard-aware hasPermission.
  import Preview from "@microservices-sh/org-team-rbac/preview";

  let { module: m }: { module: any } = $props();

  // Same shape DEFAULT_ROLES seeds per org: owner=*, admin, member.
  const roles = [
    { id: "role_owner", name: "owner", permissions: ["*"] },
    { id: "role_admin", name: "admin", permissions: ["org.read", "org.manage", "member.manage"] },
    { id: "role_member", name: "member", permissions: ["org.read"] }
  ];

  let mSeq = 1;
  let iSeq = 1;
  let members = $state<any[]>([
    { id: `mem_${mSeq++}`, userId: "user_grace", roleId: "role_owner", status: "active" },
    { id: `mem_${mSeq++}`, userId: "user_alan", roleId: "role_admin", status: "active" },
    { id: `mem_${mSeq++}`, userId: "user_ada", roleId: "role_member", status: "active" }
  ]);
  let invitations = $state<any[]>([
    { id: `inv_${iSeq++}`, email: "lin@acme.co", roleId: "role_member", status: "pending" }
  ]);

  function oninvite(input: { email: string; roleId: string }) {
    // inviteMember → member.invited
    invitations = [{ id: `inv_${iSeq++}`, email: input.email, roleId: input.roleId, status: "pending" }, ...invitations];
  }
  function onaccept(invitationId: string) {
    // acceptInvitation → member.joined (invite becomes an active membership)
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) return;
    invitations = invitations.map((i) => (i.id === invitationId ? { ...i, status: "accepted" } : i));
    const userId = "user_" + inv.email.split("@")[0];
    members = [...members, { id: `mem_${mSeq++}`, userId, roleId: inv.roleId, status: "active" }];
  }
  function onrole(memberId: string, roleId: string) {
    // updateMemberRole → role.updated
    members = members.map((mem) => (mem.id === memberId ? { ...mem, roleId } : mem));
  }
  function onremove(memberId: string) {
    // removeMember → member.removed (a removed member resolves to [] permissions)
    members = members.map((mem) => (mem.id === memberId ? { ...mem, status: "removed" } : mem));
  }
</script>

<Preview {roles} {members} {invitations} {oninvite} {onaccept} {onrole} {onremove} />
