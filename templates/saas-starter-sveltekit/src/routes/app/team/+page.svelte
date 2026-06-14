<script lang="ts">
  let { data, form } = $props();

  const roleName = (roleId: string) => data.roles.find((r) => r.id === roleId)?.name ?? roleId;
</script>

<svelte:head>
  <title>Team · SaaS Starter</title>
</svelte:head>

<main class="section">
  <p class="eyebrow">Team management</p>
  <h1>Members & invitations</h1>
  <p>Members, roles, and invites are scoped to your active organization and gated by your role.</p>

  {#if form?.error}
    <div class="status error" aria-live="polite">{form.error}</div>
  {:else if form?.invited}
    <div class="status">Invitation sent. Share this accept link: <code>/app/team/accept?token={form.token}</code></div>
  {:else if form?.roleChanged}
    <div class="status">Role updated.</div>
  {/if}

  <div class="content-grid mt-6">
    <section class="panel">
      <h2>Members</h2>
      <ul class="list" role="list">
        {#each data.members as member}
          <li class="list-item row-item">
            <div>
              <strong>{member.userId}</strong>
              <p><span class="pill">{roleName(member.roleId)}</span></p>
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
                <button type="submit" class="secondary">Update</button>
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
    </section>

    <section class="panel">
      <h2>Invite a member</h2>
      {#if data.canManage}
        <form method="POST" action="?/invite">
          <input type="hidden" name="orgId" value={data.activeOrgId ?? ""} />
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="off" required />
          </div>
          <div class="field">
            <label for="roleId">Role</label>
            <select id="roleId" name="roleId" required>
              {#each data.roles as role}
                <option value={role.id}>{role.name}</option>
              {/each}
            </select>
          </div>
          <button type="submit">Send invitation</button>
        </form>
      {:else}
        <p>You need the <code>member.manage</code> permission to invite teammates.</p>
      {/if}
    </section>
  </div>
</main>
