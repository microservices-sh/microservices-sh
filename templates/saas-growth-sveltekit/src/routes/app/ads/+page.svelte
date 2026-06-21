<script lang="ts">
  import { Button, Card, Alert, Eyebrow, Badge } from "$lib/ui";

  let { data, form } = $props();

  type CopyDraft = {
    angle: string;
    platform: string;
    headline: string;
    body: string;
    description: string;
    cta: string;
  };

  const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const campaigns = $derived(data.campaigns ?? []);
  const alerts = $derived(data.alerts ?? []);
  const totalSpend = $derived(campaigns.reduce((s: number, c: any) => s + (c.spendCents ?? 0), 0));
  const totalImpressions = $derived(campaigns.reduce((s: number, c: any) => s + (c.impressions ?? 0), 0));
  const totalClicks = $derived(campaigns.reduce((s: number, c: any) => s + (c.clicks ?? 0), 0));
  const totalConv = $derived(campaigns.reduce((s: number, c: any) => s + (c.conversions ?? 0), 0));
  const avgCtr = $derived(totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0);
  const cpa = $derived(totalConv > 0 ? totalSpend / totalConv : null);
  const zeroConvCampaigns = $derived(campaigns.filter((c: any) => (c.conversions ?? 0) === 0 && (c.spendCents ?? 0) > 0).length);
  const topCampaign = $derived(campaigns.reduce((best: any | null, c: any) => (!best || (c.conversions ?? 0) > (best.conversions ?? 0) ? c : best), null));

  const copyDrafts: CopyDraft[] = [
    {
      angle: "Pain",
      platform: "Meta feed",
      headline: "Catch ad waste before it compounds",
      body: "See spend spikes, zero-conversion campaigns, and CPC jumps in one monitoring view.",
      description: "For operators watching paid media daily.",
      cta: "Review alerts",
    },
    {
      angle: "Outcome",
      platform: "Google search",
      headline: "Turn campaign data into weekly action",
      body: "Sync insights, compare performance, and prioritize the campaigns that need attention.",
      description: "Monitoring for teams already running ads.",
      cta: "Start review",
    },
    {
      angle: "Proof",
      platform: "LinkedIn",
      headline: "A safer ads workflow for agentic teams",
      body: "Draft copy and prepare publish plans while provider writes stay behind explicit approvals.",
      description: "Built for controlled ad operations.",
      cta: "Plan campaign",
    },
  ];

  const publishPlan = [
    "Confirm platform account and campaign objective",
    "Select audience, budget, dates, and placements",
    "Approve final copy, landing URL, and UTM parameters",
    "Publish through the upstream ads service or provider UI",
  ];
</script>

<svelte:head><title>Ads Manager · SaaS Starter</title></svelte:head>

<main class="section">
  <Eyebrow>Ad monitoring</Eyebrow>
  <h1>Ads Manager</h1>
  <p class="page-copy">Monitor campaign health, review performance, draft ad copy, and prepare publish plans without mutating provider accounts from this v1 module.</p>

  {#if !data.entitled}
    <!-- 402 subscribe state -->
    <Card>
      <div class="subscribe-state">
        <h2>Subscribe to Ads</h2>
        <p>{data.reason}</p>
        <p class="price">$1.90<span>/mo</span></p>
        <p>Cross-platform monitoring (Meta, Google), daily snapshots, and anomaly alerts.</p>
        <Button href="/app/billing" variant="primary" class="mt-3">Subscribe</Button>
      </div>
    </Card>
  {:else}
    {#if form?.error}
      <Alert tone="error">{form.error}</Alert>
    {:else if form?.seeded}
      <Alert tone="success">Loaded demo data — {form.alerts} alert(s) raised.</Alert>
    {:else if form?.connected}
      <Alert tone="success">Demo account connected.</Alert>
    {/if}

    <div class="content-grid mt-6">
      <div>
        <!-- Summary -->
        <Card>
          <div class="section-head">
            <h2>Last 7 days</h2>
            <Badge tone="info">{campaigns.length} campaigns</Badge>
          </div>
          <div class="metric-grid">
            <div class="metric"><strong>{fmtMoney(totalSpend)}</strong><span>Spend</span></div>
            <div class="metric"><strong>{totalClicks.toLocaleString()}</strong><span>Clicks</span></div>
            <div class="metric"><strong>{avgCtr.toFixed(2)}%</strong><span>CTR</span></div>
            <div class="metric"><strong>{totalConv.toLocaleString()}</strong><span>Conversions</span></div>
          </div>
          <div class="action-row">
            {#if data.connections.length === 0}
              <form method="POST" action="?/connect">
                <input type="hidden" name="orgId" value={data.activeOrgId} />
                <Button type="submit" variant="primary">Connect ad account</Button>
              </form>
            {/if}
            <form method="POST" action="?/seedDemo">
              <input type="hidden" name="orgId" value={data.activeOrgId} />
              <Button type="submit" variant="ghost">Load demo data</Button>
            </form>
          </div>
        </Card>

        <!-- Campaigns -->
        <Card class="mt-6">
          <h2>Campaigns</h2>
          {#if campaigns.length === 0}
            <p>No campaigns yet. Connect an account or load demo data.</p>
          {:else}
            <div class="table-wrap">
              <table class="campaign-table">
                <caption>Campaign performance by spend, clicks, CTR, CPC, and conversions.</caption>
                <thead><tr><th>Campaign</th><th>Status</th><th>Spend</th><th>Clicks</th><th>CTR</th><th>CPC</th><th>Conv.</th></tr></thead>
                <tbody>
                  {#each campaigns as c (c.id)}
                    <tr>
                      <td>{c.name}</td>
                      <td><Badge>{c.status}</Badge></td>
                      <td>{fmtMoney(c.spendCents)}</td>
                      <td>{c.clicks}</td>
                      <td>{c.ctr}%</td>
                      <td>{fmtMoney(c.cpcCents)}</td>
                      <td>{c.conversions}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </Card>
      </div>

      <div>
        <Card>
          <div class="section-head">
            <h2>Performance review</h2>
            <Badge tone={alerts.length > 0 ? "warn" : "good"}>{alerts.length} alerts</Badge>
          </div>
          <ul class="review-list" role="list">
            <li><span>CPA</span><strong>{cpa == null ? "n/a" : fmtMoney(cpa)}</strong></li>
            <li><span>Top converter</span><strong>{topCampaign ? topCampaign.name : "n/a"}</strong></li>
            <li><span>Zero-conversion spend</span><strong>{zeroConvCampaigns}</strong></li>
          </ul>
          <p class="note">Use this view for observed facts first, then recommend budget or creative changes separately.</p>
        </Card>

        <!-- Alerts -->
        <Card class="mt-6">
          <h2>Alerts</h2>
          {#if alerts.length === 0}
            <p>No alerts. Anomalies (spend/CPC spikes, zero-conversion spend) appear here.</p>
          {:else}
            <ul class="list" role="list">
              {#each alerts as a (a.id)}
                <li class="list-item alert-item">
                  <Badge>{a.severity}</Badge>
                  <strong>{a.type}</strong>
                  <p>{a.message}</p>
                </li>
              {/each}
            </ul>
          {/if}
        </Card>
      </div>
    </div>

    <div class="workflow-grid mt-6">
      <Card>
        <div class="section-head">
          <h2>Copy draft examples</h2>
          <Badge tone="info">draft only</Badge>
        </div>
        <div class="draft-grid">
          {#each copyDrafts as draft}
            <article class="draft">
              <div class="draft__meta">
                <Badge>{draft.angle}</Badge>
                <span>{draft.platform}</span>
              </div>
              <h3>{draft.headline}</h3>
              <p>{draft.body}</p>
              <small>{draft.description}</small>
              <strong>{draft.cta}</strong>
            </article>
          {/each}
        </div>
      </Card>

      <Card>
        <div class="section-head">
          <h2>Publish plan</h2>
          <Badge tone="warn">external write</Badge>
        </div>
        <ol class="plan-list">
          {#each publishPlan as item}
            <li>{item}</li>
          {/each}
        </ol>
        <Button disabled>Provider write tool required</Button>
      </Card>
    </div>
  {/if}
</main>

<style>
  .page-copy {
    max-inline-size: 72ch;
    color: var(--color-ink-soft);
  }
  .subscribe-state {
    text-align: center;
    padding: 40px;
  }
  .price {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 12px 0;
  }
  .price span {
    font-size: 0.875rem;
    font-weight: 400;
  }
  .section-head,
  .action-row,
  .draft__meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .section-head {
    justify-content: space-between;
    margin-block-end: 14px;
  }
  .action-row {
    margin-block-start: 14px;
  }
  .metric-grid,
  .workflow-grid,
  .draft-grid {
    display: grid;
    gap: 12px;
  }
  .metric-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
  .workflow-grid {
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
    align-items: start;
  }
  .draft-grid {
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  }
  .metric,
  .draft {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel-subtle);
    padding: 12px;
  }
  .metric {
    display: grid;
    gap: 4px;
  }
  .metric strong {
    font-size: 1.25rem;
  }
  .metric span,
  .note,
  .draft small,
  .draft__meta span {
    color: var(--color-ink-soft);
  }
  .table-wrap {
    overflow-x: auto;
  }
  .campaign-table {
    width: 100%;
    border-collapse: collapse;
    min-inline-size: 680px;
  }
  .campaign-table caption {
    text-align: left;
    color: var(--color-ink-soft);
    margin-block-end: 10px;
  }
  .campaign-table th,
  .campaign-table td {
    padding: 10px 8px;
    text-align: left;
    border-block-end: 1px solid var(--color-line);
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
    gap: 14px;
  }
  .plan-list {
    padding-inline-start: 22px;
    margin-block-end: 16px;
  }
  .draft {
    display: grid;
    gap: 8px;
    align-content: start;
  }
  .draft h3 {
    font-size: 1rem;
  }
  .alert-item {
    display: grid;
    gap: 6px;
  }
  @media (max-width: 900px) {
    .workflow-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
