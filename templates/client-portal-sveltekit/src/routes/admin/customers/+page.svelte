<script lang="ts">
  import { formatMoney } from "$lib/status";
  let { data } = $props();
</script>

<svelte:head>
  <title>Customers · Admin</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Staff admin</p>
      <h1>Customers.</h1>
      <p>Customer accounts served by the customer module, with billing rollups from invoices.</p>
      <p><a class="button secondary" href="/admin">Back to overview</a></p>
    </section>

    <section class="panel">
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
              <span class="pill is-muted">
                {formatMoney(customer.outstandingCents, customer.currency)} due
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>
