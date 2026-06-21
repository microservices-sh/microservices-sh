<script lang="ts">
  import { enhance } from "$app/forms";
  import { money, relativeTime } from "$lib/format";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data, form } = $props();

  const openOrders = $derived(data.orders.filter((order) => order.status === "draft" || order.status === "confirmed"));
  const orderValue = $derived(openOrders.reduce((total, order) => total + order.totalCents, 0));
  const metrics = $derived<Metric[]>([
    { label: "Open orders", value: openOrders.length, tone: openOrders.length > 0 ? "warn" : "good", hint: "draft or confirmed" },
    { label: "Order value", value: money(orderValue), tone: "info", hint: "open total" },
    { label: "All orders", value: data.orders.length, tone: "neutral", hint: "last 100" }
  ]);

  function orderTone(status: string): "good" | "warn" | "bad" | "neutral" {
    if (status === "invoiced") return "good";
    if (status === "cancelled") return "bad";
    if (status === "confirmed") return "warn";
    return "neutral";
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
      <Button href="/app/shipments" variant="ghost">Shipments</Button>
    {/snippet}
  </PageHeader>

  {#if form?.created}
    <Alert tone="success">Sales order created.</Alert>
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
                <th scope="col">Status</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {#each data.orders as order (order.id)}
                <tr>
                  <td><code>{order.orderNumber ?? order.id}</code></td>
                  <td>{order.customerSnapshot?.displayName ?? "Walk-in customer"}</td>
                  <td>{order.lineItems.length}</td>
                  <td>{money(order.totalCents, order.currency)}</td>
                  <td><Badge tone={orderTone(order.status)}>{order.status}</Badge></td>
                  <td>{relativeTime(order.createdAt)}</td>
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
    min-width: 720px;
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
