<script lang="ts">
  import { enhance } from "$app/forms";
  import { relativeTime } from "$lib/format";
  import { printShipmentPackingSlip, printShipmentPickList, type ShipmentPrintData } from "$lib/packing-slip";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data, form } = $props();

  const shipmentDocuments = $derived(new Map(data.shipmentDocuments.map((doc) => [doc.shipmentId, doc])));
  const openShipments = $derived(data.shipments.filter((shipment) => shipment.status !== "completed" && shipment.status !== "cancelled"));
  const itemCount = $derived(data.shipments.reduce((total, shipment) => total + shipment.items.length, 0));
  const metrics = $derived<Metric[]>([
    { label: "Open shipments", value: openShipments.length, tone: openShipments.length > 0 ? "warn" : "good", hint: "draft or processing" },
    { label: "Shipment items", value: itemCount, tone: "info", hint: "last 100 batches" },
    { label: "Completed", value: data.shipments.filter((shipment) => shipment.status === "completed").length, tone: "good", hint: "closed batches" }
  ]);

  function shipmentTone(status: string): "good" | "warn" | "bad" | "neutral" {
    if (status === "completed") return "good";
    if (status === "processing") return "warn";
    if (status === "cancelled") return "bad";
    return "neutral";
  }

  function printData(shipment: (typeof data.shipments)[number]): ShipmentPrintData {
    const doc = shipmentDocuments.get(shipment.id);
    return {
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      status: shipment.status,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      notes: shipment.notes,
      createdAt: shipment.createdAt,
      orderNumber: doc?.orderNumber ?? null,
      orderStatus: doc?.orderStatus ?? null,
      customerName: doc?.customerName ?? null,
      customerEmail: doc?.customerEmail ?? null,
      customerPhone: doc?.customerPhone ?? null,
      shippingAddress: doc?.shippingAddress ?? null,
      orderNotes: doc?.orderNotes ?? null,
      items: shipment.items.map((item) => ({
        sku: item.sku,
        description: item.description,
        quantity: item.quantity
      }))
    };
  }
</script>

<svelte:head>
  <title>Shipments · Commerce Ops</title>
</svelte:head>

<main class="section shipments-page">
  <PageHeader
    eyebrow="Fulfillment"
    title="Shipments"
    description="Fulfillment batches and item lines from the StackSuite shipment module."
  >
    {#snippet actions()}
      <Button href="/app/sales-orders" variant="ghost">Sales orders</Button>
    {/snippet}
  </PageHeader>

  {#if form?.created}
    <Alert tone="success">Shipment created.</Alert>
  {:else if form?.completed}
    <Alert tone="success">Shipment completed and stock deducted.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="content-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Batches</h2>
        <Badge tone={openShipments.length > 0 ? "warn" : "good"}>{openShipments.length} open</Badge>
      </div>

      {#if data.shipments.length > 0}
        <ul class="shipment-list">
          {#each data.shipments as shipment (shipment.id)}
            <li>
              <div class="shipment-head">
                <div>
                  <strong>{shipment.shipmentNumber ?? shipment.id}</strong>
                  <p>{shipment.carrier ?? "No carrier"}{shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ""}</p>
                </div>
                <div class="shipment-actions">
                  <Badge tone={shipmentTone(shipment.status)}>{shipment.status}</Badge>
                  <Button type="button" variant="ghost" size="sm" onclick={() => printShipmentPackingSlip(printData(shipment))}>Packing slip</Button>
                  <Button type="button" variant="ghost" size="sm" onclick={() => printShipmentPickList(printData(shipment))}>Pick list</Button>
                  {#if data.canManage && shipment.status !== "completed" && shipment.status !== "cancelled"}
                    <form method="POST" action="?/complete" use:enhance>
                      <input type="hidden" name="shipmentId" value={shipment.id} />
                      <Button type="submit" variant="primary" size="sm">Complete</Button>
                    </form>
                  {/if}
                </div>
              </div>
              <div class="shipment-items">
                {#each shipment.items as item (item.id)}
                  <span>{item.sku ? `${item.sku} · ` : ""}{item.description} · {item.quantity}</span>
                {/each}
              </div>
              <small>{relativeTime(shipment.createdAt)}</small>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No shipments yet.</p>
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="content-grid mt-6">
      <Card title="Create shipment from order">
        {#if data.readyOrders.length > 0}
          <form method="POST" action="?/create" use:enhance>
            <Field label="Ready sales order" id="shipment-order">
              <select id="shipment-order" name="salesOrderId" required>
                <option value="">Select order</option>
                {#each data.readyOrders as order (order.id)}
                  <option value={order.id} selected={form?.values?.salesOrderId === order.id}>
                    {order.orderNumber ?? order.id} · {order.customerName} · {order.total} · {order.lineCount} lines
                  </option>
                {/each}
              </select>
            </Field>
            <div class="form-row">
              <Field label="Shipment number" id="shipment-number"><input id="shipment-number" name="shipmentNumber" placeholder="SHIP-1001" value={form?.values?.shipmentNumber ?? ""} /></Field>
              <Field label="Carrier" id="shipment-carrier"><input id="shipment-carrier" name="carrier" placeholder="UPS" value={form?.values?.carrier ?? ""} /></Field>
            </div>
            <Field label="Tracking" id="shipment-tracking"><input id="shipment-tracking" name="trackingNumber" placeholder="1Z..." value={form?.values?.trackingNumber ?? ""} /></Field>
            <Field label="Notes" id="shipment-notes"><textarea id="shipment-notes" name="notes" rows="3">{form?.values?.notes ?? ""}</textarea></Field>
            <Button type="submit" variant="primary">Create shipment</Button>
          </form>
        {:else}
          <div class="empty-state">
            <p>No confirmed or invoiced sales orders are ready for shipment.</p>
            <Button href="/app/sales-orders" variant="ghost">Review sales orders</Button>
          </div>
        {/if}
      </Card>
    </div>
  {/if}
</main>

<style>
  .shipments-page :global(.card__body) {
    min-width: 0;
  }
  .card-headline,
  .shipment-head,
  .shipment-actions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .shipment-actions {
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .card-headline {
    align-items: center;
    margin-block-end: 14px;
  }
  .shipment-list {
    display: grid;
    gap: 12px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .shipment-list li {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: 14px;
    background: var(--color-panel-subtle);
  }
  p,
  small {
    color: var(--color-ink-faint);
  }
  .shipment-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-block: 12px;
  }
  .shipment-items span {
    border: 1px solid var(--color-line);
    border-radius: 999px;
    padding: 5px 9px;
    font-size: 0.78rem;
    color: var(--color-ink-soft);
    background: var(--color-panel);
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .empty,
  .empty-state p {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .empty-state {
    display: grid;
    justify-items: start;
    gap: 12px;
  }
  .empty-state p {
    margin: 0;
  }
  @media (max-width: 720px) {
    .form-row,
    .shipment-head,
    .shipment-actions {
      grid-template-columns: 1fr;
      flex-direction: column;
    }
  }
</style>
