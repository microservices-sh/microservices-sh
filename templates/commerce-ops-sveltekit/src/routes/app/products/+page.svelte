<script>
  import { enhance } from "$app/forms";
  import { money } from "$lib/format";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const activeCount = $derived(data.products.filter((product) => product.active).length);
  const trackedCount = $derived(data.products.filter((product) => product.trackStock).length);
  const catalogValue = $derived(
    data.products.reduce((total, product) => total + product.priceCents, 0)
  );
  const metrics = $derived([
    { label: "Products", value: data.products.length, tone: "neutral", hint: `${activeCount} active` },
    { label: "Stock tracked", value: trackedCount, tone: trackedCount > 0 ? "good" : "neutral", hint: "inventory-ready SKUs" },
    { label: "Catalog value", value: money(catalogValue), tone: "info", hint: "sum of list prices" }
  ]);
</script>

<svelte:head>
  <title>Products · Commerce Ops</title>
</svelte:head>

<main class="section products-page">
  <PageHeader
    eyebrow="Product catalog"
    title="Products"
    description="SKU, pricing, and stock policy records from the StackSuite product-catalog module."
  >
    {#snippet actions()}
      <Button href="/app/inventory" variant="ghost">Inventory</Button>
    {/snippet}
  </PageHeader>

  {#if form?.created}
    <Alert tone="success">Product created.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="content-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Catalog</h2>
        <Badge tone={data.products.length > 0 ? "good" : "neutral"}>{data.products.length} SKUs</Badge>
      </div>

      {#if data.products.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Products</caption>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Product</th>
                <th scope="col">Price</th>
                <th scope="col">Unit</th>
                <th scope="col">Stock</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {#each data.products as product (product.id)}
                <tr>
                  <td><code>{product.sku}</code></td>
                  <td>
                    <strong>{product.name}</strong>
                    {#if product.description}<span>{product.description}</span>{/if}
                  </td>
                  <td>{money(product.priceCents, product.currency)}</td>
                  <td>{product.unit}</td>
                  <td>
                    {#if product.trackStock}
                      <Badge tone="info">reorder {product.reorderPoint}</Badge>
                    {:else}
                      <Badge>not tracked</Badge>
                    {/if}
                  </td>
                  <td><Badge tone={product.active ? "good" : "neutral"}>{product.active ? "active" : "inactive"}</Badge></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No products yet.</p>
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="content-grid mt-6">
      <Card title="Add product">
        <form method="POST" action="?/create" use:enhance>
          <div class="form-row">
            <Field label="SKU" id="product-sku"><input id="product-sku" name="sku" required placeholder="SKU-1001" value={form?.values?.sku ?? ""} /></Field>
            <Field label="Name" id="product-name"><input id="product-name" name="name" required placeholder="Premium service bundle" value={form?.values?.name ?? ""} /></Field>
          </div>
          <Field label="Description" id="product-description"><textarea id="product-description" name="description" rows="3" placeholder="Short internal description">{form?.values?.description ?? ""}</textarea></Field>
          <div class="form-row">
            <Field label="Price" id="product-price"><input id="product-price" name="price" type="number" min="0" step="0.01" value={form?.values?.price ?? "0"} /></Field>
            <Field label="Currency" id="product-currency"><input id="product-currency" name="currency" maxlength="3" value={form?.values?.currency ?? "USD"} /></Field>
            <Field label="Unit" id="product-unit"><input id="product-unit" name="unit" value={form?.values?.unit ?? "unit"} /></Field>
          </div>
          <label class="check-row"><input type="checkbox" name="trackStock" checked={form?.values?.trackStock ?? true} /> Track stock</label>
          <div class="form-row">
            <Field label="Reorder point" id="product-reorder-point"><input id="product-reorder-point" name="reorderPoint" type="number" min="0" value={form?.values?.reorderPoint ?? "0"} /></Field>
            <Field label="Reorder quantity" id="product-reorder-quantity"><input id="product-reorder-quantity" name="reorderQuantity" type="number" min="0" value={form?.values?.reorderQuantity ?? "0"} /></Field>
          </div>
          <Button type="submit" variant="primary">Create product</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .products-page :global(.card__body) {
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
    border-collapse: collapse;
    min-width: 720px;
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
    vertical-align: top;
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
  td span {
    display: block;
    margin-block-start: 3px;
    color: var(--color-ink-faint);
    font-size: 0.8rem;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .form-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .check-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-block-end: 14px;
    color: var(--color-ink-soft);
    font-size: 0.88rem;
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 720px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
