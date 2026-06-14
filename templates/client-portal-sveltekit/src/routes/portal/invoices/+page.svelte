<script lang="ts">
  import { statusPillClass, formatMoney } from "$lib/status";
  let { data } = $props();
</script>

<svelte:head>
  <title>Invoices · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Billing</p>
      <h1>Your invoices.</h1>
      <p>Every invoice issued to your account, served by the invoice module.</p>
      <p><a class="button secondary" href="/portal">Back to dashboard</a></p>
    </section>

    <section class="panel">
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
              <span class={statusPillClass(invoice.status)}>{invoice.status}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</main>
