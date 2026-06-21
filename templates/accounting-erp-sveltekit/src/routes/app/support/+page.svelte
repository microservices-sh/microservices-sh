<script>
  import { PageHeader, Card, Badge, ResourceTable, EmptyState } from "$lib/ui";

  let { data } = $props();

  const tone = (status) => {
    switch (status) {
      case "open":
        return "warn";
      case "resolved":
      case "closed":
        return "good";
      default:
        return "neutral";
    }
  };
</script>

<svelte:head>
  <title>Support | Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Support queue"
    title="Support"
    description="Customer support requests linked to this accounting workspace."
  />

  <Card title="Tickets">
    {#snippet header()}
      <Badge tone="neutral">{data.tickets.length}</Badge>
    {/snippet}

    {#if data.tickets.length > 0}
      <ResourceTable class="flush" caption="Support tickets">
        {#snippet head()}
          <tr>
            <th>Subject</th>
            <th>Requester</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        {/snippet}
        {#each data.tickets as ticket (ticket.id)}
          <tr>
            <td data-label="Subject"><strong>{ticket.subject}</strong></td>
            <td data-label="Requester" class="table-muted">{ticket.requesterEmail}</td>
            <td data-label="Priority" class="table-muted">{ticket.priority}</td>
            <td data-label="Status"><Badge tone={tone(ticket.status)}>{ticket.status}</Badge></td>
          </tr>
        {/each}
      </ResourceTable>
    {:else}
      <EmptyState title="No tickets yet" description="Opened tickets will appear here." />
    {/if}
  </Card>
</main>
