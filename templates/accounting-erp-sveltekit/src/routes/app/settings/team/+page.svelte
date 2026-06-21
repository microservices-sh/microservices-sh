<script lang="ts">
  import { Button, Field, Alert, PageHeader, Badge, CustomSelect, ResourceTable } from "$lib/ui";

  let { data, form } = $props();

  const roleName = (roleId: string) => data.roles.find((role) => role.id === roleId)?.name ?? roleId;
  const roleDetails: Record<string, string> = {
    owner: "Full company control",
    admin: "Manage team and operations",
    member: "Read workspace data"
  };
  const roleDetail = (name: string) => roleDetails[name] ?? "Scoped workspace role";
  const domId = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, "-");
  const roleOptions = $derived(
    data.roles.map((role) => ({
      value: role.id,
      label: role.name
    }))
  );
</script>

<svelte:head>
  <title>Team · Settings · ERP Shell</title>
</svelte:head>

<main class="section team-page">
  <PageHeader eyebrow="People" title="Members" />

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {:else if form?.invited}
    <Alert tone="success">Invitation sent. Share this accept link: <code>/app/team/accept?token={form.token}</code></Alert>
  {:else if form?.roleChanged}
    <Alert tone="success">Role updated.</Alert>
  {/if}

  {#if data.canManage}
    <form method="POST" action="?/invite" class="invite-toolbar" aria-label="Invite a member">
      <div class="invite-field">
        <Field label="Invite" id="email">
          <input id="email" name="email" type="email" autocomplete="email" placeholder="Email address" required />
        </Field>
      </div>
      <CustomSelect id="roleId" name="roleId" label="Role" options={roleOptions} value={data.roles[0]?.id} />
      <Button type="submit" variant="primary">Send invite</Button>
    </form>
  {:else}
    <Alert tone="warn">You can view members, but need <code>member.manage</code> to invite teammates or change roles.</Alert>
  {/if}

  {#if data.members.length > 0}
    <ResourceTable caption="Workspace members" class="member-table">
      {#snippet head()}
        <tr>
          <th scope="col">User</th>
          <th scope="col">Role</th>
          <th scope="col">State</th>
          <th scope="col">Access</th>
        </tr>
      {/snippet}

      {#each data.members as member}
        <tr>
          <td data-label="User">
            <span class="table-primary user-id">{member.userId}</span>
          </td>
          <td data-label="Role">
            {#if data.canManage}
              <form id={`role-form-${domId(member.userId)}`} method="POST" action="?/changeRole" class="role-form">
                <input type="hidden" name="userId" value={member.userId} />
                <CustomSelect
                  id={`member-role-${domId(member.userId)}`}
                  name="roleId"
                  label={`Role for ${member.userId}`}
                  hideLabel
                  options={roleOptions}
                  value={member.roleId}
                />
              </form>
            {:else}
              <Badge>{roleName(member.roleId)}</Badge>
            {/if}
          </td>
          <td data-label="State">
            <Badge tone="good">active</Badge>
          </td>
          <td data-label="Access">
            <div class="table-action">
              <span class="table-muted">{roleDetail(roleName(member.roleId))}</span>
              {#if data.canManage}
                <Button form={`role-form-${domId(member.userId)}`} type="submit" variant="primary" size="sm">Update</Button>
              {/if}
            </div>
          </td>
        </tr>
      {/each}
    </ResourceTable>
  {:else}
    <p class="empty-state">No members yet.</p>
  {/if}

  {#if data.invitations.length > 0}
    <section class="pending-block" aria-labelledby="pending-title">
      <h2 id="pending-title">Pending invitations</h2>
      <ResourceTable caption="Pending invitations">
        {#snippet head()}
          <tr>
            <th scope="col">Email</th>
            <th scope="col">State</th>
            <th scope="col">Expires</th>
          </tr>
        {/snippet}

        {#each data.invitations as inv}
          <tr>
            <td data-label="Email"><span class="table-primary">{inv.email}</span></td>
            <td data-label="State"><Badge tone="warn">pending</Badge></td>
            <td data-label="Expires">{new Date(inv.expiresAt).toLocaleDateString()}</td>
          </tr>
        {/each}
      </ResourceTable>
    </section>
  {/if}
</main>

<style>
  .team-page {
    --team-control-height: 38px;

    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .invite-toolbar {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(220px, 280px) auto;
    gap: 10px;
    align-items: end;
    min-width: 0;
  }

  .invite-toolbar :global(.field) {
    margin: 0;
  }

  .invite-toolbar :global(input),
  .invite-toolbar :global(.custom-select__trigger),
  .invite-toolbar :global(.btn),
  .role-form :global(.custom-select__trigger) {
    min-block-size: var(--team-control-height);
    block-size: var(--team-control-height);
  }

  .invite-field {
    min-width: 0;
  }

  .role-form {
    margin: 0;
    min-width: 180px;
  }

  .user-id {
    overflow-wrap: anywhere;
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }

  .empty-state,
  .pending-block {
    margin-block-start: 2px;
  }

  .pending-block {
    display: grid;
    gap: 12px;
  }

  .pending-block h2 {
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0;
  }

  @media (max-width: 980px) {
    .invite-toolbar {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .invite-toolbar :global(.btn) {
      width: 100%;
    }

    .role-form {
      min-width: 0;
    }
  }
</style>
