<script lang="ts">
  import { page } from "$app/stores";
  import { PageHeader, Card, Badge, Button, Alert, ResourceTable, EmptyState } from "$lib/ui";

  let { data } = $props();

  const money = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  // Invoice status → Badge tone. paid = good, open = warn, void = bad, draft = neutral.
  function tone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "paid":
        return "good";
      case "open":
        return "warn";
      case "void":
        return "bad";
      default:
        return "neutral";
    }
  }

  // Flash from the /new page redirect (?issued=<number>).
  const issued = $derived($page.url.searchParams.get("issued"));
</script>

<svelte:head>
  <title>Invoices · Commerce Ops</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Billing ledger"
    title="Invoices"
    description="Issue and track invoices for your company, powered by the invoice module."
  >
    {#snippet actions()}
      {#if data.canManage}
        <Button href="/app/invoices/new" variant="primary">New invoice</Button>
      {/if}
    {/snippet}
  </PageHeader>

  {#if issued}
    <Alert tone="success">Invoice {issued} issued.</Alert>
  {/if}

  <Card title="Ledger">
    {#snippet header()}
      <Badge tone="neutral">{data.invoices.length}</Badge>
    {/snippet}
    {#if data.invoices.length > 0}
      <ResourceTable class="flush" caption="Invoice ledger">
        {#snippet head()}
          <tr>
            <th>Number</th>
            <th>Customer</th>
            <th>Status</th>
            <th class="table-num">Total</th>
            <th></th>
          </tr>
        {/snippet}
        {#each data.invoices as invoice (invoice.id)}
          <tr>
            <td data-label="Number">
              <a class="table-primary" href={`/app/invoices/${invoice.id}`}>{invoice.number}</a>
            </td>
            <td data-label="Customer">
              <a href={`/app/customers/${invoice.customerId}`}>{invoice.customer}</a>
            </td>
            <td data-label="Status"><Badge tone={tone(invoice.status)}>{invoice.status}</Badge></td>
            <td data-label="Total" class="table-num">{money(invoice.totalCents, invoice.currency)}</td>
            <td class="row-go" aria-hidden="true">
              <a href={`/app/invoices/${invoice.id}`} tabindex="-1">→</a>
            </td>
          </tr>
        {/each}
      </ResourceTable>
    {:else if data.canManage}
      <EmptyState title="No invoices yet" description="Issue your first invoice to start billing.">
        {#snippet action()}
          <Button href="/app/invoices/new" variant="primary">New invoice</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState title="No invoices yet" description="Issued invoices will appear here." />
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
