<script lang="ts">
  import { PageHeader, Card, Badge, ResourceTable, EmptyState } from "$lib/ui";

  let { data } = $props();

  const money = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  const when = (iso: string) => new Date(iso).toLocaleDateString();

  function tone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "succeeded":
      case "paid":
        return "good";
      case "refunded":
        return "neutral";
      case "failed":
        return "bad";
      default:
        return "warn";
    }
  }
</script>

<svelte:head>
  <title>Payments · Commerce Ops</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Payment ledger"
    title="Payments"
    description="Captured payments for your company, powered by the payment module."
  />

  <Card title="Transactions">
    {#snippet header()}
      <Badge tone="neutral">{data.payments.length}</Badge>
    {/snippet}
    {#if data.payments.length > 0}
      <ResourceTable class="flush" caption="Payment transactions">
        {#snippet head()}
          <tr>
            <th>Customer</th>
            <th>Description</th>
            <th>Date</th>
            <th>Status</th>
            <th class="table-num">Amount</th>
            <th></th>
          </tr>
        {/snippet}
        {#each data.payments as p (p.id)}
          <tr>
            <td data-label="Customer">
              <a class="table-primary" href={`/app/payments/${p.id}`}>{p.customer}</a>
            </td>
            <td data-label="Description" class="table-muted">{p.description ?? "—"}</td>
            <td data-label="Date" class="table-muted">{when(p.createdAt)}</td>
            <td data-label="Status"><Badge tone={tone(p.status)}>{p.status}</Badge></td>
            <td data-label="Amount" class="table-num">{money(p.amount, p.currency)}</td>
            <td class="row-go" aria-hidden="true">
              <a href={`/app/payments/${p.id}`} tabindex="-1">→</a>
            </td>
          </tr>
        {/each}
      </ResourceTable>
    {:else}
      <EmptyState
        title="No payments yet"
        description="They appear here once captured through checkout (createPaymentIntent → webhook)."
      />
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
