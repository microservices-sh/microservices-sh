<script>
  import { enhance } from "$app/forms";
  import {
    downloadCsv,
    generateSalesOrderLedgerCsv,
    generateSalesOrderLineItemsCsv,
    generateSalesOrderPrintHtml,
    printDocumentHtml,
    safeDocumentFilename,
  } from "$lib/document-export";
  import { money, relativeTime } from "$lib/format";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const openOrders = $derived(data.orders.filter((order) => order.status === "draft" || order.status === "confirmed"));
  const orderValue = $derived(openOrders.reduce((total, order) => total + order.totalCents, 0));
  const metrics = $derived([
    { label: "Open orders", value: openOrders.length, tone: openOrders.length > 0 ? "warn" : "good", hint: "draft or confirmed" },
    { label: "Order value", value: money(orderValue), tone: "info", hint: "open total" },
    { label: "All orders", value: data.orders.length, tone: "neutral", hint: "last 100" }
  ]);

  function orderTone(status) {
    if (status === "invoiced") return "good";
    if (status === "cancelled") return "bad";
    if (status === "confirmed") return "warn";
    return "neutral";
  }

  function salesOrderDocument(order) {
    return {
      orderNumber: order.orderNumber ?? order.id,
      status: order.status,
      currency: order.currency,
      customer: {
        name: order.customerSnapshot?.displayName ?? "Walk-in customer",
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
    };
  }

  function printSalesOrder(order) {
    printDocumentHtml(generateSalesOrderPrintHtml(salesOrderDocument(order)), "Please allow pop-ups to print sales orders.");
  }

  function exportSalesOrder(order) {
    const doc = salesOrderDocument(order);
    downloadCsv(
      safeDocumentFilename({
        prefix: "sales-order",
        number: doc.orderNumber,
        customerName: doc.customer.name,
        date: doc.orderDate,
        extension: "csv"
      }),
      generateSalesOrderLineItemsCsv(doc)
    );
  }

  function exportSalesOrders() {
    downloadCsv(
      safeDocumentFilename({ prefix: "sales-orders", number: "ledger", date: new Date(), extension: "csv" }),
      generateSalesOrderLedgerCsv(data.orders)
    );
  }
</script>

<svelte:head>
  <title>Sales Orders · Commerce Ops</title>
</svelte:head>

<main class="section sales-orders-page">
  <PageHeader
    eyebrow="Sales order management"
    title="Sales orders"
    description="Draft and inspect customer orders before reservation, fulfillment, and invoicing."
  >
    {#snippet actions()}
      {#if data.orders.length > 0}
        <Button type="button" variant="ghost" onclick={exportSalesOrders}>Export CSV</Button>
      {/if}
      <Button href="/app/shipments" variant="ghost">Shipments</Button>
    {/snippet}
  </PageHeader>

  {#if form?.created}
    <Alert tone="success">Sales order created.</Alert>
  {:else if form?.confirmed}
    <Alert tone="success">Sales order confirmed.</Alert>
  {:else if form?.invoiced}
    <Alert tone="success">
      Invoice issued.{#if form.invoiceId} <a href={`/app/invoices/${form.invoiceId}`}>Open invoice</a>{/if}
    </Alert>
  {:else if form?.sent}
    <Alert tone="success">Sales order sent{#if form.recipient} to {form.recipient}{/if}.</Alert>
  {:else if form?.cancelled}
    <Alert tone="success">Sales order cancelled and reservations released.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="content-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Orders</h2>
        <Badge tone={openOrders.length > 0 ? "warn" : "good"}>{openOrders.length} open</Badge>
      </div>

      {#if data.orders.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Sales orders</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Lines</th>
                <th scope="col">Total</th>
                <th scope="col">Reservation</th>
                <th scope="col">Status</th>
                <th scope="col">Sent</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each data.orders as order (order.id)}
                <tr>
                  <td><a href={`/app/sales-orders/${order.id}`}><code>{order.orderNumber ?? order.id}</code></a></td>
                  <td>{order.customerSnapshot?.displayName ?? "Walk-in customer"}</td>
                  <td>{order.lineItems.length}</td>
                  <td>{money(order.totalCents, order.currency)}</td>
                  <td>{#if order.inventoryReservationId}<code>{order.inventoryReservationId}</code>{:else}<span class="muted">none</span>{/if}</td>
                  <td><Badge tone={orderTone(order.status)}>{order.status}</Badge></td>
                  <td>
                    {#if order.lastSentAt}
                      <span>{relativeTime(order.lastSentAt)}</span><br />
                      <span class="muted">{order.lastSendStatus ?? "sent"}</span>
                    {:else}
                      <span class="muted">not sent</span>
                    {/if}
                  </td>
                  <td>{relativeTime(order.createdAt)}</td>
                  <td>
                    <div class="row-actions">
                      <Button type="button" variant="ghost" size="sm" onclick={() => printSalesOrder(order)}>Print</Button>
                      <Button type="button" variant="ghost" size="sm" onclick={() => exportSalesOrder(order)}>CSV</Button>
                      <Button href={`/app/sales-orders/${order.id}`} variant="ghost" size="sm">Open</Button>
                      {#if data.canManage && order.status !== "cancelled"}
                        <form class="action-form" method="POST" action="?/send" use:enhance>
                          <input type="hidden" name="orderId" value={order.id} />
                          <Button type="submit" variant="ghost" size="sm">Send</Button>
                        </form>
                      {/if}
                      {#if data.canManage && order.status === "draft"}
                        <form class="action-form" method="POST" action="?/confirm" use:enhance>
                          <input type="hidden" name="orderId" value={order.id} />
                          <Button type="submit" variant="primary" size="sm">Confirm</Button>
                        </form>
                        <form class="action-form" method="POST" action="?/cancel" use:enhance>
                          <input type="hidden" name="orderId" value={order.id} />
                          <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                        </form>
                      {:else if data.canManage && order.status === "confirmed"}
                        <form class="action-form" method="POST" action="?/invoice" use:enhance>
                          <input type="hidden" name="orderId" value={order.id} />
                          <Button type="submit" variant="primary" size="sm">Invoice</Button>
                        </form>
                        <form class="action-form" method="POST" action="?/cancel" use:enhance>
                          <input type="hidden" name="orderId" value={order.id} />
                          <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                        </form>
                      {:else if data.canManage && order.status === "invoiced" && order.invoiceId}
                        <Button href={`/app/invoices/${order.invoiceId}`} variant="ghost" size="sm">Open</Button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No sales orders yet.</p>
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="content-grid mt-6">
      <Card title="Create draft order">
        <form method="POST" action="?/create" use:enhance>
          {#if data.customers.length > 0}
            <Field label="Existing customer" id="order-customer-id">
              <select id="order-customer-id" name="customerId">
                <option value="">New customer</option>
                {#each data.customers as customer (customer.id)}
                  <option value={customer.id} selected={form?.values?.customerId === customer.id}>
                    {customer.name} · {customer.email}
                  </option>
                {/each}
              </select>
            </Field>
          {/if}
          <div class="form-row">
            <Field label="Customer" id="order-customer"><input id="order-customer" name="customerName" placeholder="Acme Retail" value={form?.values?.customerName ?? ""} /></Field>
            <Field label="Email" id="order-email"><input id="order-email" name="customerEmail" type="email" placeholder="buyer@example.com" value={form?.values?.customerEmail ?? ""} /></Field>
          </div>
          <div class="form-row">
            <Field label="Catalog product" id="order-product">
              <select id="order-product" name="productId">
                <option value="">Manual line</option>
                {#each data.products as product (product.id)}
                  <option value={product.id}>{product.sku} · {product.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="SKU" id="order-sku"><input id="order-sku" name="sku" placeholder="SKU-1001" value={form?.values?.sku ?? ""} /></Field>
          </div>
          <Field label="Line item" id="order-item"><input id="order-item" name="itemName" required placeholder="Implementation package" value={form?.values?.itemName ?? ""} /></Field>
          <div class="form-row three">
            <Field label="Quantity" id="order-quantity"><input id="order-quantity" name="quantity" type="number" min="1" value={form?.values?.quantity ?? "1"} /></Field>
            <Field label="Unit price" id="order-price"><input id="order-price" name="unitPrice" type="number" min="0" step="0.01" value={form?.values?.unitPrice ?? "0"} /></Field>
            <Field label="Currency" id="order-currency"><input id="order-currency" name="currency" maxlength="3" value={form?.values?.currency ?? "USD"} /></Field>
          </div>
          <Field label="Notes" id="order-notes"><textarea id="order-notes" name="notes" rows="3">{form?.values?.notes ?? ""}</textarea></Field>
          <Button type="submit" variant="primary">Create draft</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .sales-orders-page :global(.card__body) {
    min-width: 0;
  }
  .card-headline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-block-end: 14px;
  }
  .table-scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 960px;
    border-collapse: collapse;
  }
  caption {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  th,
  td {
    border-block-end: 1px solid var(--color-line);
    padding: 10px 8px;
    text-align: left;
    font-size: 0.86rem;
  }
  th {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .muted {
    color: var(--color-ink-faint);
  }
  .action-form {
    margin: 0;
  }
  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .form-row.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 720px) {
    .form-row,
    .form-row.three {
      grid-template-columns: 1fr;
    }
  }
</style>
