<script lang="ts">
  import { enhance } from "$app/forms";
  import { relativeTime } from "$lib/format";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data, form } = $props();

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
                <Badge tone={shipmentTone(shipment.status)}>{shipment.status}</Badge>
              </div>
              <div class="shipment-items">
                {#each shipment.items as item (item.id)}
                  <span>{item.description} · {item.quantity}</span>
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
      <Card title="Create shipment">
        <form method="POST" action="?/create" use:enhance>
          <div class="form-row">
            <Field label="Carrier" id="shipment-carrier"><input id="shipment-carrier" name="carrier" placeholder="UPS" value={form?.values?.carrier ?? ""} /></Field>
            <Field label="Tracking" id="shipment-tracking"><input id="shipment-tracking" name="trackingNumber" placeholder="1Z..." value={form?.values?.trackingNumber ?? ""} /></Field>
          </div>
          <div class="form-row">
            <Field label="Source ref" id="shipment-source"><input id="shipment-source" name="sourceId" required placeholder="manual-001" value={form?.values?.sourceId ?? ""} /></Field>
            <Field label="SKU" id="shipment-sku"><input id="shipment-sku" name="sku" placeholder="SKU-1001" value={form?.values?.sku ?? ""} /></Field>
          </div>
          <div class="form-row">
            <Field label="Description" id="shipment-description"><input id="shipment-description" name="description" required placeholder="Starter kit" value={form?.values?.description ?? ""} /></Field>
            <Field label="Quantity" id="shipment-quantity"><input id="shipment-quantity" name="quantity" type="number" min="1" step="1" value={form?.values?.quantity ?? "1"} /></Field>
          </div>
          <Field label="Notes" id="shipment-notes"><textarea id="shipment-notes" name="notes" rows="3">{form?.values?.notes ?? ""}</textarea></Field>
          <Button type="submit" variant="primary">Create shipment</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .shipments-page :global(.card__body) {
    min-width: 0;
  }
  .card-headline,
  .shipment-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
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
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 720px) {
    .form-row,
    .shipment-head {
      grid-template-columns: 1fr;
      flex-direction: column;
    }
  }
</style>
