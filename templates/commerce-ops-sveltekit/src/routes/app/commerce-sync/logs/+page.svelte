<script>
  import { Badge, Button, Card, MetricStrip, PageHeader } from "$lib/ui";

  let { data } = $props();

  const metrics = $derived([
    { label: "Runs", value: data.runs.length, tone: data.runs.length > 0 ? "info" : "neutral", hint: "latest 50" },
    { label: "Receipts", value: data.receipts.length, tone: data.receipts.length > 0 ? "good" : "neutral", hint: "webhook ledger" },
    { label: "Mappings", value: data.mappings.length, tone: data.mappings.length > 0 ? "good" : "neutral", hint: "provider links" }
  ]);
</script>

<svelte:head>
  <title>Sync Logs · Commerce Ops</title>
</svelte:head>

<main class="section commerce-sync-logs-page">
  <PageHeader
    eyebrow="Provider sync"
    title="Sync logs"
    description="Read-only run, webhook receipt, and provider mapping logs from the commerce-sync module."
  >
    {#snippet actions()}
      <Button href="/app/commerce-sync" variant="ghost">← Commerce sync</Button>
    {/snippet}
  </PageHeader>

  <MetricStrip {metrics} />

  <div class="grid mt-6">
    <Card title="Sync runs">
      {#if data.runs.length > 0}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Connection</th>
                <th>Resource</th>
                <th>Status</th>
                <th>Processed</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Failed</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {#each data.runs as run (run.id)}
                <tr>
                  <td>
                    <strong>{run.connectionName}</strong>
                    <span>{run.provider}</span>
                  </td>
                  <td>{run.resourceType}</td>
                  <td>
                    <Badge tone={run.tone}>{run.status}</Badge>
                    {#if run.hasError}<span class="error-dot">provider error</span>{/if}
                  </td>
                  <td>{run.processedCount}</td>
                  <td>{run.createdCount}</td>
                  <td>{run.updatedCount}</td>
                  <td>{run.failedCount}</td>
                  <td>{run.started}{#if run.completed}<span>done {run.completed}</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No sync runs recorded.</p>
      {/if}
    </Card>

    <div class="split-grid">
      <Card title="Webhook receipts">
        {#if data.receipts.length > 0}
          <ul class="log-list">
            {#each data.receipts as receipt (receipt.id)}
              <li>
                <div>
                  <strong>{receipt.topic}</strong>
                  <p>{receipt.connectionName} · {receipt.provider}</p>
                  <code>{receipt.idempotencyKey}</code>
                </div>
                <div class="right">
                  <Badge tone={receipt.replayed ? "warn" : "good"}>{receipt.replayed ? "replayed" : "new"}</Badge>
                  <span>{receipt.received}</span>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty">No webhook receipts recorded.</p>
        {/if}
      </Card>

      <Card title="Provider mappings">
        {#if data.mappings.length > 0}
          <ul class="log-list">
            {#each data.mappings as mapping (mapping.id)}
              <li>
                <div>
                  <strong>{mapping.externalId}</strong>
                  <p>{mapping.connectionName} · {mapping.resourceType}</p>
                  <code>{mapping.internalId}</code>
                </div>
                <div class="right">
                  <Badge tone="info">{mapping.provider}</Badge>
                  <span>{mapping.created}</span>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty">No provider mappings recorded.</p>
        {/if}
      </Card>
    </div>

    <Card title="Connections">
      {#if data.connections.length > 0}
        <ul class="connection-list">
          {#each data.connections as connection (connection.id)}
            <li>
              <div>
                <strong>{connection.name}</strong>
                <p>{connection.provider}{connection.baseUrl ? ` · ${connection.baseUrl}` : ""}</p>
              </div>
              <div class="right">
                <Badge tone={connection.active ? "good" : "neutral"}>{connection.active ? "active" : "inactive"}</Badge>
                <span>{connection.created}</span>
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No provider connections configured.</p>
      {/if}
    </Card>
  </div>
</main>

<style>
  .grid,
  .split-grid {
    display: grid;
    gap: 16px;
  }
  .split-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 820px;
  }
  th,
  td {
    border-block-end: 1px solid var(--color-line);
    padding: 10px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  td span,
  .log-list p,
  .connection-list p,
  .right span,
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.86rem;
  }
  td span,
  .right span {
    display: block;
    margin-block-start: 4px;
  }
  .error-dot {
    color: var(--color-danger, #b42318);
    font-size: 0.78rem;
  }
  .log-list,
  .connection-list {
    display: grid;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .log-list li,
  .connection-list li {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: 12px;
    background: var(--color-panel-subtle);
  }
  .log-list p,
  .connection-list p,
  .empty {
    margin: 0;
  }
  code {
    display: inline-block;
    max-width: 100%;
    overflow-wrap: anywhere;
    color: var(--color-ink-soft);
    font-size: 0.78rem;
  }
  .right {
    display: grid;
    justify-items: end;
    gap: 4px;
    text-align: right;
  }
  @media (max-width: 900px) {
    .split-grid {
      grid-template-columns: 1fr;
    }
    .log-list li,
    .connection-list li {
      flex-direction: column;
    }
    .right {
      justify-items: start;
      text-align: left;
    }
  }
</style>
