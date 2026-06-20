<script lang="ts">
  import { PageHeader, Card, Button, Badge, ResourceTable, EmptyState } from "$lib/ui";

  let { data } = $props();

  // Ticket status -> Badge tone. open = warn, pending = neutral,
  // resolved/closed = good.
  const tone = (status: string): "good" | "warn" | "bad" | "neutral" => {
    switch (status) {
      case "open":
        return "warn";
      case "pending":
        return "neutral";
      case "resolved":
      case "closed":
        return "good";
      default:
        return "neutral";
    }
  };
</script>

<svelte:head>
  <title>Support | ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Support queue"
    title="Support"
    description="Support tickets for your company, powered by the support-ticket module."
  >
    {#snippet actions()}
      {#if data.canManage}
        <Button href="/app/support/new" variant="primary">New ticket</Button>
      {/if}
    {/snippet}
  </PageHeader>

  <Card title="Tickets">
    {#snippet header()}
      <Badge tone="neutral">{data.tickets.length}</Badge>
    {/snippet}

    {#if data.tickets.length > 0}
      <ResourceTable class="flush" caption="Support tickets">
        {#snippet head()}
          <tr>
            <th>Subject</th>
            <th>Priority</th>
            <th>Status</th>
            <th></th>
          </tr>
        {/snippet}
        {#each data.tickets as ticket (ticket.id)}
          <tr>
            <td data-label="Subject">
              <a class="table-primary" href={`/app/support/${ticket.id}`}>{ticket.subject}</a>
              <span class="table-muted">{ticket.requesterEmail}</span>
            </td>
            <td data-label="Priority" class="table-muted">{ticket.priority}</td>
            <td data-label="Status"><Badge tone={tone(ticket.status)}>{ticket.status}</Badge></td>
            <td class="row-go" aria-hidden="true">
              <a href={`/app/support/${ticket.id}`} tabindex="-1">→</a>
            </td>
          </tr>
        {/each}
      </ResourceTable>
    {:else if data.canManage}
      <EmptyState title="No tickets yet" description="Open your first ticket to start tracking support requests.">
        {#snippet action()}
          <Button href="/app/support/new" variant="primary">New ticket</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState title="No tickets yet" description="Opened tickets will appear here." />
    {/if}
  </Card>
</main>

<style>
  /* Stack the subject + requester email inside the primary cell. */
  .table-primary {
    display: block;
  }

  /* Trailing chevron column — row navigates to the ticket detail page. */
  .row-go {
    text-align: end;
    inline-size: 1%;
    white-space: nowrap;
  }
  .row-go a {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    text-decoration: none;
    transition: transform 150ms var(--ease), color 150ms var(--ease);
    display: inline-block;
  }
  /* Nudge + tint the chevron when its row is hovered (row hover lives in ResourceTable). */
  :global(.resource-table tbody tr:hover) .row-go a {
    color: var(--color-act);
    transform: translateX(3px);
  }
</style>
