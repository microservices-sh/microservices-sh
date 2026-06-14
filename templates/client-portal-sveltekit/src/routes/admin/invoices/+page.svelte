<script lang="ts">
  import { statusPillClass, formatMoney } from "$lib/status";
  let { data } = $props();
</script>

<svelte:head>
  <title>Invoices · Admin</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Staff admin</p>
      <h1>All invoices.</h1>
      <p>Every invoice across the workspace, served by the invoice module.</p>
      <p><a class="button secondary" href="/admin">Back to overview</a></p>
    </section>

    <section class="panel">
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
              <span class={statusPillClass(invoice.status)}>{invoice.status}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>
