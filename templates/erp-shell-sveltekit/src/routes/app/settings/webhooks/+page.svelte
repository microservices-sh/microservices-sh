<script lang="ts">
  import { Alert, Badge, Button, Card, Field, PageHeader, EmptyState } from "$lib/ui";

  let { data, form } = $props();

  const endpointEvents = (events: string[]) => events.length === 0 ? "All events" : events.join(", ");
</script>

<svelte:head>
  <title>Webhook endpoints · ERP Shell</title>
</svelte:head>

<main class="section webhooks-settings">
  <PageHeader
    eyebrow="Integrations"
    title="Webhook endpoints"
    description="Register HMAC-signed endpoints to receive outbound domain events. Delivery history lives in the operational Webhooks console."
  />

  {#if form?.registered}
    <Alert tone="success">Endpoint registered. Signing secret: <code>{form.secret}</code></Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="stack mt-6">
    <Card title="Endpoints">
      {#snippet header()}
        <Badge tone="neutral">{data.endpoints.length}</Badge>
      {/snippet}

      {#if data.endpoints.length > 0}
        <ul class="list" role="list">
          {#each data.endpoints as endpoint (endpoint.id)}
            <li class="endpoint">
              <code class="endpoint-url">{endpoint.url}</code>
              <span class="endpoint-events">{endpointEvents(endpoint.eventNames)}</span>
              <Badge tone={endpoint.active ? "good" : "neutral"}>{endpoint.active ? "active" : "inactive"}</Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <EmptyState
          title="No endpoints yet"
          description="Register an endpoint below to start receiving outbound domain events."
        />
      {/if}
    </Card>

    {#if data.canManage}
      <Card title="Register an endpoint">
        <form method="POST" action="?/register">
          <Field label="Endpoint URL" id="endpoint-url"><input id="endpoint-url" name="url" type="url" required placeholder="https://example.com/webhooks/microservices" /></Field>
          <Field label="Event names" id="endpoint-events"><textarea id="endpoint-events" name="eventNames" rows="4" placeholder="customer.created, payment.succeeded"></textarea></Field>
          <Button type="submit" variant="primary">Register</Button>
        </form>
      </Card>
    {/if}
  </div>
</main>

<style>
  .webhooks-settings :global(.card__body) {
    min-width: 0;
  }
  .stack {
    display: grid;
    gap: 18px;
    align-items: start;
  }
  .list {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .endpoint {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding-block: 10px;
    border-block-end: 1px solid var(--color-line);
  }
  .endpoint:last-child {
    border-block-end: none;
  }
  .endpoint-url {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
    flex: 1 1 240px;
    min-inline-size: 0;
  }
  .endpoint-events {
    font-size: 0.84rem;
    color: var(--color-ink-soft);
  }
</style>
