<script>
  import { enhance } from "$app/forms";
  import { printShipmentPackingSlip, printShipmentPickList } from "$lib/packing-slip";
  import { Alert, Badge, Button, Card, PageHeader, WorkflowTimeline } from "$lib/ui";

  let { data, form } = $props();
  const shipment = $derived(data.shipment);
  const document = $derived(data.printDocument);
  const canStartProcessing = $derived(data.canManage && shipment.status === "draft");
  const canComplete = $derived(data.canManage && shipment.status !== "completed" && shipment.status !== "cancelled");

  function printPackingSlip() {
    printShipmentPackingSlip(document);
  }

  function printPickList() {
    printShipmentPickList(document);
  }
</script>

<svelte:head>
  <title>{shipment.displayNumber} · Shipments · Commerce Ops</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Shipment" title={shipment.displayNumber}>
    {#snippet actions()}
      <Button type="button" variant="ghost" onclick={printPickList}>Pick list</Button>
      <Button type="button" variant="primary" onclick={printPackingSlip}>Packing slip</Button>
      <Button href="/app/shipments" variant="ghost">← Shipments</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={shipment.tone}>{shipment.status}</Badge>
      {#if shipment.carrier}<span>· {shipment.carrier}</span>{/if}
      {#if shipment.trackingNumber}<span>· {shipment.trackingNumber}</span>{/if}
    {/snippet}
  </PageHeader>

  {#if form?.processingStarted}
    <Alert tone="success">Shipment moved to processing.</Alert>
  {:else if form?.completed}
    <Alert tone="success">Shipment completed and stock deducted.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="grid">
    <div class="grid__main">
      <Card title="Summary">
        <dl class="detail-list">
          <div><dt>Status</dt><dd><Badge tone={shipment.tone}>{shipment.status}</Badge></dd></div>
          <div><dt>Created</dt><dd>{shipment.created}</dd></div>
          <div><dt>Completed</dt><dd>{shipment.completed ?? "—"}</dd></div>
          <div><dt>Carrier</dt><dd>{shipment.carrier ?? "—"}</dd></div>
          <div><dt>Tracking</dt><dd>{shipment.trackingNumber ?? "—"}</dd></div>
          <div><dt>Items</dt><dd>{shipment.itemCount}</dd></div>
          <div><dt>Inventory ref</dt><dd>{shipment.inventoryDeductionRef ?? "—"}</dd></div>
          <div>
            <dt>Sales order</dt>
            <dd>
              {#if data.order}
                <a href={`/app/sales-orders/${data.order.id}`}>{data.order.orderNumber}</a>
                <span class="muted"> · {data.order.status}</span>
              {:else}
                —
              {/if}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Shipment lines">
        {#if shipment.items.length > 0}
          <div class="lines">
            {#each shipment.items as item (item.id)}
              <div class="line">
                <div>
                  <strong>{item.description}</strong>
                  <p>{item.sku ?? "No SKU"}{item.productId ? ` · ${item.productId}` : ""}</p>
                </div>
                <span>{item.quantity}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty">No shipment lines recorded.</p>
        {/if}
      </Card>

      <Card title="Activity">
        <WorkflowTimeline events={data.timeline} emptyLabel="No activity recorded for this shipment yet." />
      </Card>

      <Card title="Status history">
        {#if data.statusTransitions.length > 0}
          <div class="status-history">
            {#each data.statusTransitions as transition (transition.id)}
              <div class="status-row">
                <div>
                  <strong>{transition.fromStatus ?? "created"} -> {transition.toStatus}</strong>
                  <p>{transition.reason ?? "No reason recorded"}{transition.actorId ? ` · ${transition.actorId}` : ""}</p>
                </div>
                <div class="status-row__meta">
                  <Badge tone={transition.tone}>{transition.toStatus}</Badge>
                  <span>{transition.changed}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty">No status transitions recorded.</p>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Documents">
        <div class="stack">
          <p class="status-note">Print fulfillment documents from the same shipment and sales-order snapshot used by the batch list.</p>
          <Button type="button" variant="primary" onclick={printPackingSlip}>Packing slip</Button>
          <Button type="button" variant="ghost" onclick={printPickList}>Pick list</Button>
        </div>
      </Card>

      <Card title="Destination">
        <dl class="compact-list">
          <div><dt>Customer</dt><dd>{document.customerName ?? data.order?.customerName ?? "—"}</dd></div>
          <div><dt>Email</dt><dd>{document.customerEmail ?? "—"}</dd></div>
          <div><dt>Phone</dt><dd>{document.customerPhone ?? "—"}</dd></div>
          <div><dt>Address</dt><dd>{document.shippingAddress ?? "—"}</dd></div>
        </dl>
      </Card>

      {#if canStartProcessing || canComplete}
        <Card title="Fulfillment actions">
          <div class="stack">
            {#if canStartProcessing}
              <form method="POST" action="?/startProcessing" use:enhance>
                <div class="stack">
                  <p class="status-note">Start processing to record picking and packing work before stock deduction.</p>
                  <Button type="submit" variant="ghost">Start processing</Button>
                </div>
              </form>
            {/if}
            {#if canComplete}
              <form method="POST" action="?/complete" use:enhance>
                <div class="stack">
                  <p class="status-note">Completing deducts reserved stock through the shared shipment inventory bridge.</p>
                  <Button type="submit" variant="primary">Complete shipment</Button>
                </div>
              </form>
            {/if}
          </div>
        </Card>
      {/if}
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
  .lines {
    display: grid;
    gap: 10px;
  }
  .line {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: 12px;
    background: var(--color-panel-subtle);
  }
  .status-history {
    display: grid;
    gap: 10px;
  }
  .status-row,
  .status-row__meta {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .status-row {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: 12px;
    background: var(--color-panel-subtle);
  }
  .status-row__meta {
    align-items: flex-end;
    flex-direction: column;
    color: var(--color-ink-faint);
    font-size: 0.82rem;
  }
  .line p,
  .status-row p,
  .status-note,
  .muted,
  .empty {
    color: var(--color-ink-faint);
  }
  .line p,
  .status-row p,
  .status-note,
  .empty {
    margin: 0;
    font-size: 0.9rem;
  }
  .line span {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .compact-list dd {
    white-space: pre-wrap;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
