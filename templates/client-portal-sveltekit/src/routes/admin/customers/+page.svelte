<script lang="ts">
  import { formatMoney } from "$lib/status";
  import { Button, Card, Eyebrow, Badge } from "$lib/ui";
  let { data } = $props();
</script>

<svelte:head>
  <title>Customers · Admin</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Staff admin</Eyebrow>
      <h1>Customers.</h1>
      <p>Customer accounts served by the customer module, with billing rollups from invoices.</p>
      <p><Button href="/admin" variant="ghost">Back to overview</Button></p>
    </section>

    <Card>
      <h2>All customers</h2>
      {#if data.customers.length === 0}
        <p>No customers yet.</p>
      {:else}
        <ul class="list">
          {#each data.customers as customer}
            <li class="list-item row-item">
              <div>
                <strong>{customer.name}</strong>
                <p>{customer.email} · {customer.invoiceCount} invoice(s)</p>
              </div>
              <Badge tone="neutral">
                {formatMoney(customer.outstandingCents, customer.currency)} due
              </Badge>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </div>
</main>
