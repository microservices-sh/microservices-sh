<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Badge, Button, ResourceTable, EmptyState } from "$lib/ui";

  let { data } = $props();

  const when = (iso: string) => new Date(iso).toLocaleString();
</script>

<svelte:head>
  <title>Notifications · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Your inbox"
    title="Notifications"
    description="In-app notifications addressed to you, powered by the notifications-inapp module."
  >
    {#snippet actions()}
      {#if data.unread > 0}
        <Badge tone="warn">{data.unread} unread</Badge>
        <form method="POST" action="?/markAll" use:enhance>
          <Button type="submit" variant="ghost" size="sm">Mark all read</Button>
        </form>
      {/if}
    {/snippet}
  </PageHeader>

  <Card title="Feed">
    {#snippet header()}
      <Badge tone="neutral">{data.notifications.length}</Badge>
    {/snippet}
    {#if data.notifications.length > 0}
      <ResourceTable class="flush" caption="Notification feed">
        {#snippet head()}
          <tr>
            <th>Notification</th>
            <th>Received</th>
            <th>Status</th>
            <th></th>
          </tr>
        {/snippet}
        {#each data.notifications as n (n.id)}
          <tr>
            <td data-label="Notification">
              <span class="notif-title" class:is-unread={!n.readAt}>{n.title ?? n.type}</span>
              {#if n.body}<span class="notif-text">{n.body}</span>{/if}
            </td>
            <td data-label="Received" class="table-muted">{when(n.createdAt)}</td>
            <td data-label="Status">
              {#if n.readAt}
                <Badge tone="neutral">read</Badge>
              {:else}
                <Badge tone="warn">unread</Badge>
              {/if}
            </td>
            <td class="table-action">
              {#if !n.readAt}
                <form method="POST" action="?/markRead" use:enhance>
                  <input type="hidden" name="id" value={n.id} />
                  <Button type="submit" variant="ghost" size="sm">Mark read</Button>
                </form>
              {/if}
            </td>
          </tr>
        {/each}
      </ResourceTable>
    {:else}
      <EmptyState
        title="No notifications yet"
        description="They appear here when other modules notify you (e.g. an invoice is paid or a ticket changes status)."
      />
    {/if}
  </Card>
</main>

<style>
  .notif-title {
    display: block;
    font-weight: 650;
    color: var(--color-ink);
  }
  .notif-title.is-unread {
    border-inline-start: 2px solid var(--color-act);
    padding-inline-start: 8px;
    margin-inline-start: -10px;
  }
  .notif-text {
    display: block;
    margin-block-start: 2px;
    color: var(--color-ink-soft);
    font-size: 0.9rem;
  }
</style>
