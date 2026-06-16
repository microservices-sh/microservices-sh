<script lang="ts">
  import { Button, Field, Panel, StatusMessage, Eyebrow, Badge } from "$lib/components";

  let { data, form } = $props();

  const roleName = (roleId: string) => data.roles.find((r) => r.id === roleId)?.name ?? roleId;
</script>

<svelte:head>
  <title>Team · SaaS Starter</title>
</svelte:head>

<main class="section">
  <Eyebrow>Team management</Eyebrow>
  <h1>Members & invitations</h1>
  <p>Members, roles, and invites are scoped to your active organization and gated by your role.</p>

  {#if form?.error}
    <StatusMessage variant="error" live>{form.error}</StatusMessage>
  {:else if form?.invited}
    <StatusMessage>Invitation sent. Share this accept link: <code>/app/team/accept?token={form.token}</code></StatusMessage>
  {:else if form?.roleChanged}
    <StatusMessage>Role updated.</StatusMessage>
  {/if}

  <div class="content-grid mt-6">
    <Panel>
      <h2>Members</h2>
      <ul class="list" role="list">
        {#each data.members as member}
          <li class="list-item row-item">
            <div>
              <strong>{member.userId}</strong>
              <p><Badge>{roleName(member.roleId)}</Badge></p>
            </div>
            {#if data.canManage}
              <form method="POST" action="?/changeRole" class="flex items-center gap-2">
                <input type="hidden" name="orgId" value={data.activeOrgId ?? ""} />
                <input type="hidden" name="userId" value={member.userId} />
                <select name="roleId" aria-label="Change role">
                  {#each data.roles as role}
                    <option value={role.id} selected={role.id === member.roleId}>{role.name}</option>
                  {/each}
                </select>
                <Button type="submit" variant="secondary">Update</Button>
              </form>
            {/if}
          </li>
        {/each}
      </ul>

      {#if data.invitations.length > 0}
        <h3 class="mt-6">Pending invitations</h3>
        <ul class="list" role="list">
          {#each data.invitations as inv}
            <li class="list-item">
              {inv.email} <span>· expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </Panel>

    <Panel>
      <h2>Invite a member</h2>
      {#if data.canManage}
        <form method="POST" action="?/invite">
          <input type="hidden" name="orgId" value={data.activeOrgId ?? ""} />
          <Field label="Email" id="email">
            <input id="email" name="email" type="email" autocomplete="off" required />
          </Field>
          <Field label="Role" id="roleId">
            <select id="roleId" name="roleId" required>
              {#each data.roles as role}
                <option value={role.id}>{role.name}</option>
              {/each}
            </select>
          </Field>
          <Button type="submit">Send invitation</Button>
        </form>
      {:else}
        <p>You need the <code>member.manage</code> permission to invite teammates.</p>
      {/if}
    </Panel>
  </div>
</main>
