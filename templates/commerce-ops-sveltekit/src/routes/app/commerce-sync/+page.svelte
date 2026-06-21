<script lang="ts">
  import { enhance } from "$app/forms";
  import { MetricStrip, PageHeader, Card, Badge, Alert, Button, Field } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data, form } = $props();

  const metrics = $derived<Metric[]>([
    { label: "Connections", value: data.connections.length, tone: data.connections.length > 0 ? "good" : "neutral", hint: "provider links" },
    { label: "Processed", value: data.run?.processedCount ?? 0, tone: "info", hint: "last sync run" },
    { label: "Failures", value: data.run?.failedCount ?? 0, tone: data.run?.failedCount ? "bad" : "good", hint: data.status.status }
  ]);
</script>

<svelte:head>
  <title>Commerce Sync · Commerce Ops</title>
</svelte:head>

<main class="section commerce-sync-page">
  <PageHeader
    eyebrow="Provider sync"
    title="Commerce sync"
    description="Connection, mapping, sync-run, and webhook receipt contracts for external commerce platforms."
  />

  {#if form?.connectionCreated}
    <Alert tone="success">Provider connection created.</Alert>
  {:else if form?.runRecorded}
    <Alert tone="success">Manual sync run recorded.</Alert>
  {:else if form?.webhookRecorded}
    <Alert tone="success">Webhook receipt recorded.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <MetricStrip {metrics} />

  <div class="grid mt-6">
    <Card title="Connections">
      {#snippet header()}<Badge tone="info">{data.status.status}</Badge>{/snippet}
      {#if data.connections.length > 0}
        <ul class="list">
          {#each data.connections as connection (connection.id)}
            <li class="list-item row-item">
              <div>
                <strong>{connection.name}</strong>
                <p>{connection.provider} · {connection.baseUrl ?? "no base URL"}</p>
              </div>
              <Badge tone={connection.active ? "good" : "neutral"}>{connection.active ? "active" : "inactive"}</Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No provider connections configured.</p>
      {/if}
    </Card>

    <Card title="Latest run">
      {#if data.run}
        <dl class="stats">
          <div><dt>Status</dt><dd><Badge tone="good">{data.run.status}</Badge></dd></div>
          <div><dt>Processed</dt><dd>{data.run.processedCount}</dd></div>
          <div><dt>Created</dt><dd>{data.run.createdCount}</dd></div>
          <div><dt>Updated</dt><dd>{data.run.updatedCount}</dd></div>
          <div><dt>Failed</dt><dd>{data.run.failedCount}</dd></div>
        </dl>
      {:else}
        <p class="empty">No sync run available.</p>
      {/if}
    </Card>

    <Card title="Mapping and webhook">
      <div class="contract-list">
        {#if data.mapping}
          <div>
            <span>Provider mapping</span>
            <strong>{data.mapping.externalId}</strong>
            <p>{data.mapping.resourceType} → {data.mapping.internalId}</p>
          </div>
        {/if}
        {#if data.webhook}
          <div>
            <span>Webhook receipt</span>
            <strong>{data.webhook.topic}</strong>
            <p>{data.webhook.replayed ? "replayed" : "new"} · {data.webhook.idempotencyKey}</p>
          </div>
        {/if}
      </div>
    </Card>
  </div>

  {#if data.canManage}
    <div class="operator-grid mt-6">
      <Card title="Create connection">
        <form method="POST" action="?/createConnection" use:enhance>
          <div class="form-row">
            <Field label="Provider" id="connection-provider">
              <select id="connection-provider" name="provider">
                <option value="woocommerce">WooCommerce</option>
                <option value="shopify">Shopify</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Name" id="connection-name">
              <input id="connection-name" name="name" required placeholder="WooCommerce primary" value={form?.values?.name ?? ""} />
            </Field>
          </div>
          <Field label="Base URL" id="connection-base-url">
            <input id="connection-base-url" name="baseUrl" placeholder="https://store.example.com" value={form?.values?.baseUrl ?? ""} />
          </Field>
          <Field label="Secret reference" id="connection-secret-ref">
            <input
              id="connection-secret-ref"
              name="secretRef"
              required
              placeholder="secret://commerce/woo-primary"
              value={form?.values?.secretRef ?? ""}
            />
          </Field>
          <Button type="submit" variant="primary">Create connection</Button>
        </form>
      </Card>

      <Card title="Record manual run">
        <form method="POST" action="?/recordManualRun" use:enhance>
          <Field label="Connection" id="run-connection">
            <select id="run-connection" name="connectionId" required disabled={data.connections.length === 0}>
              <option value="">Choose connection</option>
              {#each data.connections as connection (connection.id)}
                <option value={connection.id}>{connection.name}</option>
              {/each}
            </select>
          </Field>
          <Field label="Resource" id="run-resource">
            <select id="run-resource" name="resourceType">
              <option value="product">Product</option>
              <option value="order">Order</option>
              <option value="customer">Customer</option>
              <option value="category">Category</option>
              <option value="inventory">Inventory</option>
            </select>
          </Field>
          <div class="counter-row">
            <Field label="Processed" id="run-processed"><input id="run-processed" name="processedCount" type="number" min="0" value="10" /></Field>
            <Field label="Created" id="run-created"><input id="run-created" name="createdCount" type="number" min="0" value="2" /></Field>
            <Field label="Updated" id="run-updated"><input id="run-updated" name="updatedCount" type="number" min="0" value="8" /></Field>
            <Field label="Failed" id="run-failed"><input id="run-failed" name="failedCount" type="number" min="0" value="0" /></Field>
          </div>
          <Button type="submit" variant="primary" disabled={data.connections.length === 0}>Record run</Button>
        </form>
      </Card>

      <Card title="Record webhook">
        <form method="POST" action="?/recordWebhook" use:enhance>
          <Field label="Connection" id="webhook-connection">
            <select id="webhook-connection" name="connectionId" required disabled={data.connections.length === 0}>
              <option value="">Choose connection</option>
              {#each data.connections as connection (connection.id)}
                <option value={connection.id}>{connection.name}</option>
              {/each}
            </select>
          </Field>
          <div class="form-row">
            <Field label="Topic" id="webhook-topic">
              <input id="webhook-topic" name="topic" required placeholder="orders/create" value={form?.values?.topic ?? ""} />
            </Field>
            <Field label="Idempotency key" id="webhook-key">
              <input id="webhook-key" name="idempotencyKey" required placeholder="delivery-1001" value={form?.values?.idempotencyKey ?? ""} />
            </Field>
          </div>
          <Field label="Signature" id="webhook-signature">
            <input id="webhook-signature" name="signature" placeholder="base64 or sha256=..." value={form?.values?.signature ?? ""} />
          </Field>
          <Field label="Webhook secret" id="webhook-secret">
            <input id="webhook-secret" name="webhookSecret" type="password" placeholder="Use WOOCOMMERCE_WEBHOOK_SECRET when blank" />
          </Field>
          <Field label="Payload JSON" id="webhook-payload">
            <textarea id="webhook-payload" name="payload" rows="4">{form?.values?.payload ?? '{ "id": "demo-order-1001" }'}</textarea>
          </Field>
          <Button type="submit" variant="primary" disabled={data.connections.length === 0}>Record webhook</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .grid {
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.8fr);
  }
  .grid :global(.card:last-child) {
    grid-column: 1 / -1;
  }
  .stats {
    display: grid;
    gap: 10px;
    margin: 0;
  }
  .stats div,
  .contract-list div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-block-end: 1px solid var(--color-line);
    padding-block-end: 10px;
  }
  .stats dt,
  .contract-list span {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .stats dd {
    margin: 0;
  }
  .contract-list {
    display: grid;
    gap: 14px;
  }
  .operator-grid {
    display: grid;
    grid-template-columns: minmax(280px, 1fr) minmax(320px, 1fr);
    gap: 16px;
  }
  .operator-grid :global(.card:last-child) {
    grid-column: 1 / -1;
  }
  .operator-grid form {
    display: grid;
    gap: 12px;
  }
  .form-row,
  .counter-row {
    display: grid;
    gap: 12px;
  }
  .form-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .counter-row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .contract-list div {
    align-items: flex-start;
    display: grid;
    gap: 4px;
  }
  p,
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 860px) {
    .grid,
    .operator-grid,
    .form-row,
    .counter-row {
      grid-template-columns: 1fr;
    }
    .operator-grid :global(.card:last-child) {
      grid-column: auto;
    }
  }
</style>
