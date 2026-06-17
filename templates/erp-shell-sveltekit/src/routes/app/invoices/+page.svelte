<script lang="ts">
  import { Card, Eyebrow, Badge } from "$lib/ui";

  let { data } = $props();

  const money = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  // Invoice status → Badge tone. paid = good, open = warn, void = bad, draft = neutral.
  const tone = (status: string): "good" | "warn" | "bad" | "neutral" => {
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
  };
</script>

<svelte:head>
  <title>Invoices · ERP Shell</title>
</svelte:head>

<main class="section">
  <Eyebrow>Billing ledger</Eyebrow>
  <h1>Invoices</h1>
  <p>Issued and draft invoices for your company, powered by the invoice module.</p>

  <Card class="mt-6">
    {#if data.invoices.length > 0}
      <ul class="list" role="list">
        {#each data.invoices as invoice}
          <li class="list-item row-item">
            <span><strong>{invoice.number}</strong> · {invoice.customer}</span>
            <span class="nav" style="align-items: center;">
              <Badge tone={tone(invoice.status)}>{invoice.status}</Badge>
              <span>{money(invoice.totalCents, invoice.currency)}</span>
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p>No invoices yet.</p>
    {/if}
  </Card>
</main>
