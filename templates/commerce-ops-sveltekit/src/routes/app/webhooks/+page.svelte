<script>
  import { enhance } from "$app/forms";
  import { Alert, Badge, Button, Card, Field, PageHeader, MetricStrip } from "$lib/ui";

  let { data, form } = $props();

  const when = (iso) => new Date(iso).toLocaleString();
  const endpointUrl = (id) => data.endpoints.find((endpoint) => endpoint.id === id)?.url ?? id;

  const activeEndpoints = $derived(data.endpoints.filter((endpoint) => endpoint.active).length);
  const failedDeliveries = $derived(data.deliveries.filter((delivery) => delivery.status === "failed").length);

  const metrics = $derived([
    { label: "Endpoints", value: data.endpoints.length, tone: "neutral", hint: "registered" },
    { label: "Active", value: activeEndpoints, tone: activeEndpoints > 0 ? "good" : "neutral", hint: "receiving" },
    { label: "Deliveries", value: data.deliveries.length, tone: "neutral", hint: "logged" },
    { label: "Failures", value: failedDeliveries, tone: failedDeliveries > 0 ? "bad" : "good", hint: failedDeliveries > 0 ? "needs review" : "all delivered" }
  ]);

  function statusTone(status) {
    if (status === "delivered") return "good";
    if (status === "failed") return "bad";
    return "neutral";
  }
</script>

<svelte:head>
  <title>Webhooks · Commerce Ops</title>
</svelte:head>

<main class="section webhooks-page">
  <PageHeader
    eyebrow="External events"
    title="Webhooks"
    description="Outbound delivery review for HMAC-signed domain events."
  >
    {#snippet actions()}
      <Button href="/app/settings/webhooks" variant="ghost">Manage endpoints</Button>
    {/snippet}
  </PageHeader>

  {#if form?.delivered}
    <Alert tone="success">Delivery matched {form.matched} endpoint{form.matched === 1 ? "" : "s"}: {form.deliveredCount} delivered, {form.failedCount} failed.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="content-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Delivery log</h2>
        <Badge tone={failedDeliveries > 0 ? "bad" : "good"}>{failedDeliveries} failed</Badge>
      </div>

      {#if data.deliveries.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Webhook delivery attempts</caption>
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Endpoint</th>
                <th scope="col">Status</th>
                <th scope="col">Code</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {#each data.deliveries as delivery}
                <tr>
                  <td><code>{delivery.eventName}</code></td>
                  <td class="url-cell"><code>{endpointUrl(delivery.endpointId)}</code></td>
                  <td><Badge tone={statusTone(delivery.status)}>{delivery.status}</Badge></td>
                  <td>{delivery.statusCode ?? "n/a"}</td>
                  <td>{when(delivery.createdAt)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No delivery attempts have been logged.</p>
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="content-grid mt-6">
      <Card>
        <h2>Test delivery</h2>
        <form method="POST" action="?/deliverDemo" use:enhance>
          <Field label="Event name" id="event-name"><input id="event-name" name="eventName" required placeholder="customer.created" /></Field>
          <div class="form-row">
            <Field label="Entity type" id="entity-type"><input id="entity-type" name="entityType" required placeholder="customer" /></Field>
            <Field label="Entity id" id="entity-id"><input id="entity-id" name="entityId" required placeholder="cus_123" /></Field>
          </div>
          <Field label="Payload JSON" id="event-payload"><textarea id="event-payload" name="payload" rows="5" placeholder='&#123;"email":"buyer@example.com"&#125;'></textarea></Field>
          <Button type="submit" variant="primary">Simulate delivery</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .webhooks-page :global(.card__body) {
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
    min-width: 620px;
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
  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .url-cell {
    max-inline-size: 260px;
    overflow-wrap: anywhere;
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
  @media (max-width: 560px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
