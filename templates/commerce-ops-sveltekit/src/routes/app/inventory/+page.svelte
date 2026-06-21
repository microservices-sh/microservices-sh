<script>
  import { enhance } from "$app/forms";
  import { relativeTime } from "$lib/format";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const lowStock = $derived(
    data.balances.filter((item) => item.balance.available <= item.reorderPoint).length
  );
  const available = $derived(
    data.balances.reduce((total, item) => total + item.balance.available, 0)
  );
  const trackedProducts = $derived(data.products.filter((product) => product.trackStock));
  const adjustmentMovements = $derived(data.movements.filter((movement) => movement.movementType === "adjustment"));
  const metrics = $derived([
    { label: "Tracked SKUs", value: data.balances.length, tone: "neutral", hint: "default location" },
    { label: "Available", value: available, tone: available > 0 ? "good" : "neutral", hint: "units on hand" },
    { label: "Below reorder", value: lowStock, tone: lowStock > 0 ? "warn" : "good", hint: lowStock > 0 ? "review purchasing" : "all clear" }
  ]);

  function movementTone(type) {
    if (type === "stock_in" || type === "release") return "good";
    if (type === "reservation") return "warn";
    if (type === "deduction") return "bad";
    return "neutral";
  }

  function signed(value) {
    if (value > 0) return `+${value}`;
    return String(value);
  }
</script>

<svelte:head>
  <title>Inventory · Commerce Ops</title>
</svelte:head>

<main class="section inventory-page">
  <PageHeader
    eyebrow="Inventory"
    title="Stock control"
    description="Balances and movement history from the StackSuite inventory module."
  >
    {#snippet actions()}
      <Button href="/app/products" variant="ghost">Products</Button>
    {/snippet}
  </PageHeader>

  {#if form?.stocked}
    <Alert tone="success">Stock movement recorded.</Alert>
  {:else if form?.adjusted}
    <Alert tone="success">Stock adjustment recorded.</Alert>
  {:else if form?.reconciled}
    <Alert tone="success">Physical count reconciled.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="content-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Main location balances</h2>
        <Badge tone={lowStock > 0 ? "warn" : "good"}>{lowStock} low</Badge>
      </div>

      {#if data.balances.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Inventory balances</caption>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Product</th>
                <th scope="col">On hand</th>
                <th scope="col">Reserved</th>
                <th scope="col">Available</th>
                <th scope="col">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {#each data.balances as item (item.productId)}
                <tr>
                  <td><code>{item.sku}</code></td>
                  <td>{item.name}</td>
                  <td>{item.balance.onHand}</td>
                  <td>{item.balance.reserved}</td>
                  <td><strong>{item.balance.available}</strong></td>
                  <td><Badge tone={item.balance.available <= item.reorderPoint ? "warn" : "good"}>{item.reorderPoint}</Badge></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">Create a stock-tracked product before receiving inventory.</p>
      {/if}
    </Card>
  </div>

  <div class="content-grid mt-6">
    <Card title="Recent movements">
      {#if data.movements.length > 0}
        <ul class="list">
          {#each data.movements as movement (movement.id)}
            <li class="list-item row-item">
              <div>
                <strong>{movement.productId}</strong>
                <p>
                  {movement.locationId} · {relativeTime(movement.createdAt)}
                  · on-hand {signed(movement.onHandDelta)}
                  {movement.reason ? ` · ${movement.reason}` : ""}
                </p>
              </div>
              <Badge tone={movementTone(movement.movementType)}>{movement.movementType} {movement.quantity}</Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No stock movements yet.</p>
      {/if}
    </Card>
    <Card title="Recent counts & adjustments">
      {#if adjustmentMovements.length > 0}
        <ul class="list">
          {#each adjustmentMovements.slice(0, 8) as movement (movement.id)}
            <li class="list-item row-item">
              <div>
                <strong>{movement.productId}</strong>
                <p>{movement.locationId} · {relativeTime(movement.createdAt)}{movement.reason ? ` · ${movement.reason}` : ""}</p>
              </div>
              <Badge tone={movement.onHandDelta < 0 ? "warn" : "good"}>on-hand {signed(movement.onHandDelta)}</Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No physical counts or manual adjustments yet.</p>
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="action-grid mt-6">
      <Card title="Receive stock">
        <form method="POST" action="?/stockIn" use:enhance>
          <div class="form-row">
            <Field label="Product" id="stock-product">
              <select id="stock-product" name="productId" required>
                <option value="">Choose product</option>
                {#each trackedProducts as product (product.id)}
                  <option value={product.id}>{product.sku} · {product.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Location" id="stock-location"><input id="stock-location" name="locationId" value={form?.values?.locationId ?? "default"} /></Field>
            <Field label="Quantity" id="stock-quantity"><input id="stock-quantity" name="quantity" type="number" min="1" step="1" value={form?.values?.quantity ?? "1"} /></Field>
          </div>
          <Field label="Reason" id="stock-reason"><input id="stock-reason" name="reason" placeholder="Purchase order receipt" value={form?.values?.reason ?? ""} /></Field>
          <Button type="submit" variant="primary">Record receipt</Button>
        </form>
      </Card>
      <Card title="Adjust stock">
        <form method="POST" action="?/adjustStock" use:enhance>
          <div class="form-row">
            <Field label="Product" id="adjust-product">
              <select id="adjust-product" name="productId" required>
                <option value="">Choose product</option>
                {#each trackedProducts as product (product.id)}
                  <option value={product.id}>{product.sku} · {product.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Location" id="adjust-location"><input id="adjust-location" name="locationId" value={form?.values?.locationId ?? "default"} /></Field>
            <Field label="Delta" id="adjust-quantity"><input id="adjust-quantity" name="adjustment" type="number" step="1" value={form?.values?.adjustment ?? "-1"} /></Field>
          </div>
          <Field label="Reference" id="adjust-reference"><input id="adjust-reference" name="reference" placeholder="cycle-count-2026-06" value={form?.values?.reference ?? ""} /></Field>
          <Field label="Reason" id="adjust-reason"><input id="adjust-reason" name="reason" placeholder="Damage, shrinkage, correction" value={form?.values?.reason ?? ""} /></Field>
          <Button type="submit" variant="primary">Record adjustment</Button>
        </form>
      </Card>
      <Card title="Reconcile count">
        <form method="POST" action="?/reconcileStock" use:enhance>
          <div class="form-row">
            <Field label="Product" id="reconcile-product">
              <select id="reconcile-product" name="productId" required>
                <option value="">Choose product</option>
                {#each trackedProducts as product (product.id)}
                  <option value={product.id}>{product.sku} · {product.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Location" id="reconcile-location"><input id="reconcile-location" name="locationId" value={form?.values?.locationId ?? "default"} /></Field>
            <Field label="Counted" id="reconcile-counted"><input id="reconcile-counted" name="countedQuantity" type="number" min="0" step="1" value={form?.values?.countedQuantity ?? "0"} /></Field>
          </div>
          <Field label="Count reference" id="reconcile-reference"><input id="reconcile-reference" name="reference" placeholder="physical-count-2026-06" value={form?.values?.reference ?? ""} /></Field>
          <Field label="Reason" id="reconcile-reason"><input id="reconcile-reason" name="reason" placeholder="Physical count reconciliation" value={form?.values?.reason ?? ""} /></Field>
          <Button type="submit" variant="primary">Reconcile count</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .inventory-page :global(.card__body) {
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
    min-width: 640px;
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
    grid-template-columns: 1.5fr 1fr 1fr;
    gap: 12px;
  }
  .action-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 720px) {
    .form-row {
      grid-template-columns: 1fr;
    }
    .action-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (min-width: 721px) and (max-width: 1120px) {
    .action-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
