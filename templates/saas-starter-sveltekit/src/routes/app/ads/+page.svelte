<script lang="ts">
  let { data, form } = $props();

  const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const totalSpend = $derived((data.campaigns ?? []).reduce((s: number, c: any) => s + (c.spendCents ?? 0), 0));
  const totalClicks = $derived((data.campaigns ?? []).reduce((s: number, c: any) => s + (c.clicks ?? 0), 0));
  const totalConv = $derived((data.campaigns ?? []).reduce((s: number, c: any) => s + (c.conversions ?? 0), 0));
</script>

<svelte:head><title>Ads Manager · SaaS Starter</title></svelte:head>

<main class="section">
  <p class="eyebrow">Ad monitoring</p>
  <h1>Ads Manager</h1>

  {#if !data.entitled}
    <!-- 402 subscribe state -->
    <div class="panel" style="text-align:center; padding:40px;">
      <h2>Subscribe to Ads</h2>
      <p>{data.reason}</p>
      <p style="font-size:28px; font-weight:700; margin:12px 0;">$1.90<span style="font-size:14px; font-weight:400;">/mo</span></p>
      <p>Cross-platform monitoring (Meta, Google), daily snapshots, and anomaly alerts.</p>
      <a class="button" href="/app/billing" style="display:inline-block; margin-top:12px;">Subscribe →</a>
    </div>
  {:else}
    {#if form?.error}
      <div class="status error">{form.error}</div>
    {:else if form?.seeded}
      <div class="status">Loaded demo data — {form.alerts} alert(s) raised.</div>
    {:else if form?.connected}
      <div class="status">Demo account connected.</div>
    {/if}

    <div class="content-grid mt-6">
      <div>
        <!-- Summary -->
        <div class="panel">
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
                <button type="submit">Connect ad account</button>
              </form>
            {/if}
            <form method="POST" action="?/seedDemo">
              <input type="hidden" name="orgId" value={data.activeOrgId} />
              <button type="submit" class="secondary">Load demo data</button>
            </form>
          </div>
        </div>

        <!-- Campaigns -->
        <div class="panel mt-6">
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
                    <td><span class="pill">{c.status}</span></td>
                    <td>{fmtMoney(c.spendCents)}</td>
                    <td>{c.clicks}</td>
                    <td>{c.ctr}%</td>
                    <td>{fmtMoney(c.cpcCents)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      </div>

      <!-- Alerts -->
      <div class="panel">
        <h2>Alerts</h2>
        {#if (data.alerts ?? []).length === 0}
          <p>No alerts. Anomalies (spend/CPC spikes, zero-conversion spend) appear here.</p>
        {:else}
          <ul class="list" role="list">
            {#each data.alerts as a (a.id)}
              <li class="list-item">
                <span class="pill">{a.severity}</span>
                <strong>{a.type}</strong>
                <p>{a.message}</p>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</main>
