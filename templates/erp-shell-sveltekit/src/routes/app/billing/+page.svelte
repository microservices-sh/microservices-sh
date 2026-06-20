<script lang="ts">
  import { PageHeader, Card, Badge, Button, ResourceTable, EmptyState } from "$lib/ui";

  let { data } = $props();

  function tone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "active":
      case "trialing":
        return "good";
      case "past_due":
      case "unpaid":
        return "warn";
      default:
        return "neutral";
    }
  }
</script>

<svelte:head>
  <title>Billing · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Recurring billing"
    title="Billing"
    description="Customer subscriptions, powered by the billing-subscriptions module."
  >
    {#snippet actions()}
      <Button href="/app/settings/plans" variant="ghost">Manage plans</Button>
      {#if data.canManage}
        <Button href="/app/billing/new" variant="primary">New subscription</Button>
      {/if}
    {/snippet}
  </PageHeader>

  <Card title="Subscriptions">
    {#snippet header()}
      <Badge tone="neutral">{data.subscriptions.length}</Badge>
    {/snippet}
    {#if data.subscriptions.length > 0}
      <ResourceTable class="flush" caption="Customer subscriptions">
        {#snippet head()}
          <tr>
            <th>Subscriber</th>
            <th>Plan</th>
            <th>Status</th>
            <th></th>
          </tr>
        {/snippet}
        {#each data.subscriptions as sub (sub.id)}
          <tr>
            <td data-label="Subscriber">
              <a class="table-primary" href={`/app/billing/${sub.id}`}>{sub.subscriber}</a>
            </td>
            <td data-label="Plan" class="table-muted">{sub.plan}</td>
            <td data-label="Status"><Badge tone={tone(sub.status)}>{sub.status}</Badge></td>
            <td class="row-go" aria-hidden="true">
              <a href={`/app/billing/${sub.id}`} tabindex="-1">→</a>
            </td>
          </tr>
        {/each}
      </ResourceTable>
    {:else if data.canManage}
      <EmptyState title="No subscriptions yet" description="Start your first subscription to begin recurring billing.">
        {#snippet action()}
          <Button href="/app/billing/new" variant="primary">New subscription</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState title="No subscriptions yet" description="Started subscriptions will appear here." />
    {/if}
  </Card>
</main>

<style>
  .row-go {
    text-align: end;
    inline-size: 1%;
    white-space: nowrap;
  }
  .row-go a {
    display: inline-block;
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    text-decoration: none;
    transition:
      transform 150ms var(--ease),
      color 150ms var(--ease);
  }
  :global(.resource-table tbody tr:hover) .row-go a {
    color: var(--color-act);
    transform: translateX(3px);
  }
</style>
