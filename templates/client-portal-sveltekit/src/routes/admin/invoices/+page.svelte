<script lang="ts">
  import { statusBadgeVariant, formatMoney } from "$lib/status";
  import { Button, Panel, Eyebrow, Badge } from "$lib/components";
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
      <p><Button href="/admin" variant="secondary">Back to overview</Button></p>
    </section>

    <Panel>
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
              <Badge variant={statusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
            </li>
          {/each}
        </ul>
      {/if}
    </Panel>
  </div>
</main>
