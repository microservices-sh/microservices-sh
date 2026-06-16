<script lang="ts">
  import { statusBadgeVariant, formatMoney } from "$lib/status";
  import { Button, Panel, Eyebrow, Badge } from "$lib/components";
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.invoice.number ?? "Draft invoice"} · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Invoice</Eyebrow>
      <h1>{data.invoice.number ?? "Draft invoice"}</h1>
      <p>
        {formatMoney(data.invoice.totalCents, data.invoice.currency)} ·
        <Badge variant={statusBadgeVariant(data.invoice.status)}>{data.invoice.status}</Badge>
      </p>
      <p><Button href="/portal/invoices" variant="secondary">Back to invoices</Button></p>
    </section>

    <Panel>
      <h2>Summary</h2>
      <dl class="detail-list">
        <div>
          <dt>Status</dt>
          <dd><Badge variant={statusBadgeVariant(data.invoice.status)}>{data.invoice.status}</Badge></dd>
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
    </Panel>

    <Panel>
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
    </Panel>

    {#if data.invoice.notes}
      <Panel>
        <h2>Notes</h2>
        <p>{data.invoice.notes}</p>
      </Panel>
    {/if}
  </div>
</main>
