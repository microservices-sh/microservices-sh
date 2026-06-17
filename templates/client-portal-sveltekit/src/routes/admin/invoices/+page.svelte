<script lang="ts">
  import { statusBadgeVariant, formatMoney } from "$lib/status";
  import { Button, Card, Eyebrow, Badge } from "$lib/ui";
  let { data } = $props();
</script>

<svelte:head>
  <title>Invoices · Admin</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Staff admin</Eyebrow>
      <h1>All invoices.</h1>
      <p>Every invoice across the workspace, served by the invoice module.</p>
      <p><Button href="/admin" variant="ghost">Back to overview</Button></p>
    </section>

    <Card>
      <h2>Invoices</h2>
      {#if data.invoices.length === 0}
        <p>No invoices yet.</p>
      {:else}
        <ul class="list">
          {#each data.invoices as invoice}
            <li class="list-item row-item">
              <div>
                <strong>{invoice.number ?? "Draft"}</strong>
                <p>{invoice.customerName} · {formatMoney(invoice.totalCents, invoice.currency)}</p>
              </div>
              <Badge tone={statusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </div>
</main>
