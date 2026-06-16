<script lang="ts">
  import { Button, Panel, StatusMessage, Eyebrow, Badge } from "$lib/components";

  let { data, form } = $props();

  const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const totalSpend = $derived((data.campaigns ?? []).reduce((s: number, c: any) => s + (c.spendCents ?? 0), 0));
  const totalClicks = $derived((data.campaigns ?? []).reduce((s: number, c: any) => s + (c.clicks ?? 0), 0));
  const totalConv = $derived((data.campaigns ?? []).reduce((s: number, c: any) => s + (c.conversions ?? 0), 0));
</script>

<svelte:head><title>Ads Manager · SaaS Starter</title></svelte:head>

<main class="section">
  <Eyebrow>Ad monitoring</Eyebrow>
  <h1>Ads Manager</h1>

  {#if !data.entitled}
    <!-- 402 subscribe state -->
    <Panel as="div" style="text-align:center; padding:40px;">
      <h2>Subscribe to Ads</h2>
      <p>{data.reason}</p>
      <p style="font-size:28px; font-weight:700; margin:12px 0;">$1.90<span style="font-size:14px; font-weight:400;">/mo</span></p>
      <p>Cross-platform monitoring (Meta, Google), daily snapshots, and anomaly alerts.</p>
      <Button href="/app/billing" style="display:inline-block; margin-top:12px;">Subscribe →</Button>
    </Panel>
  {:else}
    {#if form?.error}
      <StatusMessage variant="error">{form.error}</StatusMessage>
    {:else if form?.seeded}
      <StatusMessage>Loaded demo data — {form.alerts} alert(s) raised.</StatusMessage>
    {:else if form?.connected}
      <StatusMessage>Demo account connected.</StatusMessage>
    {/if}

    <div class="content-grid mt-6">
      <div>
        <!-- Summary -->
        <Panel as="div">
          <h2>Last 7 days</h2>
          <div style="display:flex; gap:24px; flex-wrap:wrap;">
            <div><strong style="font-size:22px;">{fmtMoney(totalSpend)}</strong><p>Spend</p></div>
            <div><strong style="font-size:22px;">{totalClicks.toLocaleString()}</strong><p>Clicks</p></div>
            <div><strong style="font-size:22px;">{totalConv.toLocaleString()}</strong><p>Conversions</p></div>
          </div>
          <div style="margin-top:14px; display:flex; gap:8px;">
            {#if data.connections.length === 0}
              <form method="POST" action="?/connect">
                <input type="hidden" name="orgId" value={data.activeOrgId} />
                <Button type="submit">Connect ad account</Button>
              </form>
            {/if}
            <form method="POST" action="?/seedDemo">
              <input type="hidden" name="orgId" value={data.activeOrgId} />
              <Button type="submit" variant="secondary">Load demo data</Button>
            </form>
          </div>
        </Panel>

        <!-- Campaigns -->
        <Panel as="div" class="mt-6">
          <h2>Campaigns</h2>
          {#if (data.campaigns ?? []).length === 0}
            <p>No campaigns yet. Connect an account or load demo data.</p>
          {:else}
            <table style="width:100%; border-collapse:collapse;">
              <thead><tr style="text-align:left;"><th>Campaign</th><th>Status</th><th>Spend</th><th>Clicks</th><th>CTR</th><th>CPC</th></tr></thead>
              <tbody>
                {#each data.campaigns as c (c.id)}
                  <tr>
                    <td>{c.name}</td>
                    <td><Badge>{c.status}</Badge></td>
                    <td>{fmtMoney(c.spendCents)}</td>
                    <td>{c.clicks}</td>
                    <td>{c.ctr}%</td>
                    <td>{fmtMoney(c.cpcCents)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </Panel>
      </div>

      <!-- Alerts -->
      <Panel as="div">
        <h2>Alerts</h2>
        {#if (data.alerts ?? []).length === 0}
          <p>No alerts. Anomalies (spend/CPC spikes, zero-conversion spend) appear here.</p>
        {:else}
          <ul class="list" role="list">
            {#each data.alerts as a (a.id)}
              <li class="list-item">
                <Badge>{a.severity}</Badge>
                <strong>{a.type}</strong>
                <p>{a.message}</p>
              </li>
            {/each}
          </ul>
        {/if}
      </Panel>
    </div>
  {/if}
</main>
