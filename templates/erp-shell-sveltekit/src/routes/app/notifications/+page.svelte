<script lang="ts">
  import { enhance } from "$app/forms";
  import { Card, Eyebrow, Badge, Button } from "$lib/ui";

  let { data } = $props();

  const when = (iso: string) => new Date(iso).toLocaleString();
</script>

<svelte:head>
  <title>Notifications · ERP Shell</title>
</svelte:head>

<main class="section">
  <Eyebrow>Your inbox</Eyebrow>
  <h1>Notifications</h1>
  <p>In-app notifications addressed to you, powered by the notifications-inapp module.</p>

  <Card class="mt-6">
    <header class="notif-head">
      <h2>Feed {#if data.unread > 0}<Badge tone="warn">{data.unread} unread</Badge>{/if}</h2>
      {#if data.unread > 0}
        <form method="POST" action="?/markAll" use:enhance>
          <Button type="submit" variant="ghost" size="sm">Mark all read</Button>
        </form>
      {/if}
    </header>

    {#if data.notifications.length > 0}
      <ul class="list" role="list">
        {#each data.notifications as n}
          <li class="list-item notif-item" class:is-unread={!n.readAt}>
            <div class="notif-body">
              <span class="notif-title">{n.title ?? n.type}</span>
              {#if n.body}<span class="notif-text">{n.body}</span>{/if}
              <span class="notif-meta">{when(n.createdAt)}</span>
            </div>
            {#if !n.readAt}
              <form method="POST" action="?/markRead" use:enhance>
                <input type="hidden" name="id" value={n.id} />
                <Button type="submit" variant="ghost" size="sm">Mark read</Button>
              </form>
            {:else}
              <Badge tone="neutral">read</Badge>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No notifications yet. They appear here when other modules notify you (e.g. an invoice is paid or a ticket changes status).</p>
    {/if}
  </Card>
</main>

<style>
  .notif-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-block-end: 4px;
  }
  .notif-head h2 {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .notif-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .notif-item.is-unread {
    border-inline-start: 2px solid var(--color-act);
    padding-inline-start: 10px;
  }
  .notif-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .notif-title {
    font-weight: 600;
  }
  .notif-text {
    color: var(--color-ink-soft);
    font-size: 0.9rem;
  }
  .notif-meta {
    color: var(--color-ink-faint);
    font-size: 0.78rem;
    font-family: var(--font-mono);
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
</style>
