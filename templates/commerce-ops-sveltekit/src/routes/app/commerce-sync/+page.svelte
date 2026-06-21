<script lang="ts">
  import { MetricStrip, PageHeader, Card, Badge } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data } = $props();

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
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
