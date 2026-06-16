<script lang="ts">
  import { statusBadgeVariant, formatMoney } from "$lib/status";
  import { Button, Panel, Eyebrow, Badge } from "$lib/components";
  let { data } = $props();
</script>

<svelte:head>
  <title>Invoices · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Billing</Eyebrow>
      <h1>Your invoices.</h1>
      <p>Every invoice issued to your account, served by the invoice module.</p>
      <p><Button href="/portal" variant="secondary">Back to dashboard</Button></p>
    </section>

    <Panel>
      <h2>All invoices</h2>
      {#if data.invoices.length === 0}
        <p>No invoices yet.</p>
      {:else}
        <ul class="list">
          {#each data.invoices as invoice}
            <li class="list-item row-item">
              <div>
                <a href={`/portal/invoices/${invoice.id}`}>
                  <strong>{invoice.number ?? "Draft"}</strong>
                </a>
                <p>
                  {formatMoney(invoice.totalCents, invoice.currency)}
                  {#if invoice.dueAt}· due {new Date(invoice.dueAt).toLocaleDateString()}{/if}
                </p>
              </div>
              <Badge variant={statusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
            </li>
          {/each}
        </ul>
      {/if}
    </Panel>
  </div>
</main>
