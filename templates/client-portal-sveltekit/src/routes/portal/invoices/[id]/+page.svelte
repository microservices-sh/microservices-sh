<script lang="ts">
  import { statusPillClass, formatMoney } from "$lib/status";
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.invoice.number ?? "Draft invoice"} · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Invoice</p>
      <h1>{data.invoice.number ?? "Draft invoice"}</h1>
      <p>
        {formatMoney(data.invoice.totalCents, data.invoice.currency)} ·
        <span class={statusPillClass(data.invoice.status)}>{data.invoice.status}</span>
      </p>
      <p><a class="button secondary" href="/portal/invoices">Back to invoices</a></p>
    </section>

    <section class="panel">
      <h2>Summary</h2>
      <dl class="detail-list">
        <div>
          <dt>Status</dt>
          <dd><span class={statusPillClass(data.invoice.status)}>{data.invoice.status}</span></dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(data.invoice.subtotalCents, data.invoice.currency)}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{formatMoney(data.invoice.taxCents, data.invoice.currency)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatMoney(data.invoice.totalCents, data.invoice.currency)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{formatMoney(data.invoice.amountPaidCents, data.invoice.currency)}</dd>
        </div>
        {#if data.invoice.issuedAt}
          <div>
            <dt>Issued</dt>
            <dd>{new Date(data.invoice.issuedAt).toLocaleDateString()}</dd>
          </div>
        {/if}
        {#if data.invoice.dueAt}
          <div>
            <dt>Due</dt>
            <dd>{new Date(data.invoice.dueAt).toLocaleDateString()}</dd>
          </div>
        {/if}
        <div>
          <dt>Reference</dt>
          <dd><code>{data.invoice.id}</code></dd>
        </div>
      </dl>
    </section>

    <section class="panel">
      <h2>Line items</h2>
      {#if data.lineItems.length === 0}
        <p>No line items.</p>
      {:else}
        <ul class="list">
          {#each data.lineItems as item}
            <li class="list-item row-item">
              <div>
                <strong>{item.description}</strong>
                <p>{item.quantity} × {formatMoney(item.unitAmountCents, data.invoice.currency)}</p>
              </div>
              <span>{formatMoney(item.amountCents, data.invoice.currency)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if data.invoice.notes}
      <section class="panel">
        <h2>Notes</h2>
        <p>{data.invoice.notes}</p>
      </section>
    {/if}
  </div>
</main>
