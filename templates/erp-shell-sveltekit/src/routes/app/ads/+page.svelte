<script lang="ts">
  import { Card, PageHeader, Badge, Button, Alert } from "$lib/ui";

  let { data, form } = $props();

  const when = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString() : "n/a";
  const connectionCount = $derived(data.connections.length);
  const alertCount = $derived(data.alerts.length);

  const copyDrafts = [
    {
      angle: "Pain",
      headline: "Stop finding ad waste after the invoice lands",
      body: "Flag spend spikes, CPC jumps, and zero-conversion campaigns before they become a weekly surprise.",
      cta: "Review alerts"
    },
    {
      angle: "Outcome",
      headline: "A cleaner weekly paid-media review",
      body: "Bring connected accounts, campaign health, and anomaly history into the same operator workspace.",
      cta: "Start review"
    },
    {
      angle: "Control",
      headline: "Draft with agents, publish with approval",
      body: "Prepare copy and campaign plans while account mutations stay behind provider write tools.",
      cta: "Prepare plan"
    }
  ];

  const publishSteps = [
    "Campaign and ad set names",
    "Audience, placements, budget, and dates",
    "Copy, landing URL, and UTM parameters",
    "Approval owner and upstream publish action"
  ];

  function sevTone(s: string): "good" | "warn" | "bad" | "neutral" {
    switch (s) {
      case "critical":
        return "bad";
      case "warning":
        return "warn";
      default:
        return "neutral";
    }
  }

  function statusTone(s: string): "good" | "warn" | "bad" | "neutral" {
    switch (s) {
      case "connected":
        return "good";
      case "error":
        return "bad";
      case "disconnected":
        return "warn";
      default:
        return "neutral";
    }
  }
</script>

<svelte:head>
  <title>Ads · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Ad monitoring"
    title="Ads"
    description="Anomaly alerts, performance review, and draft planning for paid media operators."
  >
    {#snippet actions()}
      <Button href="/app/settings/connections" variant="ghost">Manage connections</Button>
    {/snippet}
  </PageHeader>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card>
      <h2>Connected accounts</h2>
      {#if data.connections.length > 0}
        <ul class="list" role="list">
          {#each data.connections as conn}
            <li class="list-item row-item">
              <span><strong>{conn.displayName ?? conn.adAccountId}</strong> · {conn.platform}</span>
              <Badge tone={statusTone(conn.status)}>{conn.status}</Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No ad accounts connected yet.</p>
      {/if}
      <Button href="/app/settings/connections" variant="ghost" size="sm">Manage connections</Button>
    </Card>

    <Card>
      <h2>Alerts</h2>
      {#if data.alerts.length > 0}
        <ul class="list" role="list">
          {#each data.alerts as alert}
            <li class="list-item alert-item">
              <Badge tone={sevTone(alert.severity)}>{alert.severity}</Badge>
              <span class="alert-msg">{alert.message}</span>
              <span class="alert-meta">{when(alert.firedAt ?? alert.date)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No alerts. Anomalies raised against connected accounts appear here.</p>
      {/if}
    </Card>
  </div>

  <div class="workflow-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Performance review</h2>
        <Badge tone={alertCount > 0 ? "warn" : "good"}>{alertCount} alerts</Badge>
      </div>
      <ul class="review-list" role="list">
        <li><span>Connections</span><strong>{connectionCount}</strong></li>
        <li><span>Alert state</span><strong>{alertCount > 0 ? "Needs review" : "Clear"}</strong></li>
        <li><span>Insight source</span><strong>Upstream connector</strong></li>
      </ul>
    </Card>

    <Card>
      <div class="card-headline">
        <h2>Copy drafts</h2>
        <Badge tone="info">draft only</Badge>
      </div>
      <div class="draft-stack">
        {#each copyDrafts as draft}
          <article class="draft">
            <div class="draft-meta">
              <Badge>{draft.angle}</Badge>
              <strong>{draft.cta}</strong>
            </div>
            <h3>{draft.headline}</h3>
            <p>{draft.body}</p>
          </article>
        {/each}
      </div>
    </Card>

    <Card>
      <div class="card-headline">
        <h2>Publish plan</h2>
        <Badge tone="warn">external write</Badge>
      </div>
      <ol class="plan-list">
        {#each publishSteps as step}
          <li>{step}</li>
        {/each}
      </ol>
      <Button disabled>Provider write tool required</Button>
    </Card>
  </div>
</main>

<style>
  .alert-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .alert-msg {
    flex: 1;
    font-size: 0.9rem;
  }
  .alert-meta {
    font-size: 0.74rem;
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .workflow-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
    align-items: start;
  }
  .card-headline,
  .draft-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-block-end: 12px;
  }
  .review-list,
  .plan-list {
    margin: 0;
    padding: 0;
  }
  .review-list {
    list-style: none;
    display: grid;
    gap: 10px;
  }
  .review-list li,
  .plan-list li {
    border-block-end: 1px solid var(--color-line);
    padding-block: 10px;
  }
  .review-list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .plan-list {
    padding-inline-start: 22px;
    margin-block-end: 16px;
  }
  .draft-stack {
    display: grid;
    gap: 12px;
  }
  .draft {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel-subtle);
    padding: 12px;
  }
  .draft h3 {
    font-size: 0.96rem;
    margin-block-end: 6px;
  }
  .draft p {
    color: var(--color-ink-soft);
    font-size: 0.88rem;
    margin: 0;
  }
</style>
