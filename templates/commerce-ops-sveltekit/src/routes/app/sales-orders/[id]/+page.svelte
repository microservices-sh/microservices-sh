<script>
  import {
    downloadCsv,
    generateSalesOrderLineItemsCsv,
    generateSalesOrderPrintHtml,
    printDocumentHtml,
    safeDocumentFilename,
  } from "$lib/document-export";
  import { money } from "$lib/format";
  import { Badge, Button, Card, PageHeader } from "$lib/ui";

  let { data } = $props();
  const order = $derived(data.order);

  const salesOrderDocument = $derived({
    orderNumber: order.displayNumber,
    status: order.status,
    currency: order.currency,
    customer: {
      name: order.customerSnapshot?.displayName ?? order.customerName,
      email: order.customerSnapshot?.email ?? null,
      phone: order.customerSnapshot?.phone ?? null,
      billingAddress: order.customerSnapshot?.billingAddress ?? null,
      shippingAddress: order.customerSnapshot?.shippingAddress ?? null,
      taxId: order.customerSnapshot?.taxId ?? null
    },
    orderDate: order.createdAt,
    notes: order.notes,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    lineItems: order.lineItems
  });

  function printSalesOrder() {
    printDocumentHtml(generateSalesOrderPrintHtml(salesOrderDocument), "Please allow pop-ups to print sales orders.");
  }

  function exportSalesOrder() {
    downloadCsv(
      safeDocumentFilename({
        prefix: "sales-order",
        number: salesOrderDocument.orderNumber,
        customerName: salesOrderDocument.customer.name,
        date: salesOrderDocument.orderDate,
        extension: "csv"
      }),
      generateSalesOrderLineItemsCsv(salesOrderDocument)
    );
  }
</script>

<svelte:head>
  <title>{order.displayNumber} · Sales Orders · Commerce Ops</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Sales order" title={order.displayNumber}>
    {#snippet actions()}
      <Button type="button" variant="ghost" onclick={exportSalesOrder}>CSV</Button>
      <Button type="button" variant="primary" onclick={printSalesOrder}>Print</Button>
      <Button href="/app/sales-orders" variant="ghost">← Sales orders</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={order.tone}>{order.status}</Badge>
      <span>·</span>
      {#if order.customerId}
        <a href={`/app/customers/${order.customerId}`}>{order.customerName}</a>
      {:else}
        <span>{order.customerName}</span>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="grid">
    <div class="grid__main">
      <Card title="Summary">
        <dl class="detail-list">
          <div><dt>Status</dt><dd><Badge tone={order.tone}>{order.status}</Badge></dd></div>
          <div><dt>Customer</dt><dd>{order.customerName}</dd></div>
          <div><dt>Created</dt><dd>{order.created}</dd></div>
          <div><dt>Confirmed</dt><dd>{order.confirmed ?? "—"}</dd></div>
          <div><dt>Invoiced</dt><dd>{order.invoiced ?? "—"}</dd></div>
          <div><dt>Cancelled</dt><dd>{order.cancelled ?? "—"}</dd></div>
          <div><dt>Reservation</dt><dd>{order.inventoryReservationId ?? "—"}</dd></div>
          <div>
            <dt>Invoice</dt>
            <dd>
              {#if order.invoiceId}
                <a href={`/app/invoices/${order.invoiceId}`}>{order.invoiceId}</a>
              {:else}
                —
              {/if}
            </dd>
          </div>
          <div><dt>Subtotal</dt><dd class="num">{order.subtotal}</dd></div>
          <div><dt>Discount</dt><dd class="num">{order.discount}</dd></div>
          <div><dt>Tax</dt><dd class="num">{order.tax}</dd></div>
          <div><dt>Total</dt><dd class="num strong">{order.total}</dd></div>
        </dl>
      </Card>

      <Card title="Line items">
        {#if order.lineItems.length > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {#each order.lineItems as item (item.id)}
                  <tr>
                    <td>{item.sku ?? "—"}</td>
                    <td>
                      <strong>{item.name}</strong>
                      {#if item.description}<span>{item.description}</span>{/if}
                    </td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unitPriceCents, order.currency)}</td>
                    <td>{money(item.totalCents, order.currency)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No sales order lines recorded.</p>
        {/if}
      </Card>

      {#if order.notes}
        <Card title="Notes">
          <p class="status-note">{order.notes}</p>
        </Card>
      {/if}
    </div>

    <div class="grid__side">
      <Card title="Documents">
        <div class="stack">
          <p class="status-note">Print or export the current order snapshot for customer review and internal fulfillment.</p>
          <Button type="button" variant="primary" onclick={printSalesOrder}>Print sales order</Button>
          <Button type="button" variant="ghost" onclick={exportSalesOrder}>Export line CSV</Button>
        </div>
      </Card>

      <Card title="Lifecycle">
        <div class="stack">
          <p class="status-note">Use the sales-order ledger for confirm, invoice, and cancel actions so stock and invoice side effects stay in one operator workflow.</p>
          <Button href="/app/sales-orders" variant="ghost">Open ledger actions</Button>
          {#if order.invoiceId}
            <Button href={`/app/invoices/${order.invoiceId}`} variant="ghost">Open invoice</Button>
          {/if}
        </div>
      </Card>
    </div>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
    margin-block-start: 4px;
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.85fr);
    align-items: start;
  }
  .grid__main,
  .grid__side,
  .stack {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 620px;
    border-collapse: collapse;
  }
  th,
  td {
    border-block-end: 1px solid var(--color-line);
    padding: 10px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  td span {
    display: block;
    color: var(--color-ink-faint);
    font-size: 0.84rem;
    margin-block-start: 3px;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .strong {
    font-weight: 600;
    color: var(--color-ink);
  }
  .status-note,
  .empty {
    margin: 0;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
