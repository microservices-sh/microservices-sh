<!--
  Ads Manager surface — explains and demonstrates what the module does (monitor ad
  spend across Meta + Google over an upstream service: a normalized campaign view,
  insight snapshots, and anomaly alerts). Built on the shared DS; connections /
  campaigns / alerts + handlers are host-supplied. The point shown here: this module
  holds a connection *reference* (never platform tokens) and runs the
  monitoring/alerting layer — spend spikes, CPC spikes, zero-conversion spend.
  Reused by the harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Platform = "meta" | "google";
  type Connection = { id: string; platform: Platform; displayName: string; adAccountId: string; status: "connected" | "disconnected" | "error" };
  type Campaign = { id: string; platform: Platform; name: string; status: string; spendCents: number; impressions: number; clicks: number; ctr: number; cpcCents: number; conversions: number; roas?: number };
  type Alert = { id: string; type: "spend_spike" | "cpc_spike" | "zero_conv"; severity: "info" | "warning" | "critical"; message: string; firedAt: string; acknowledgedAt: string | null };

  let {
    connections = [],
    campaigns = [],
    alerts = [],
    lastSync = null,
    busy = false,
    onsync,
    onack
  }: {
    connections?: Connection[];
    campaigns?: Campaign[];
    alerts?: Alert[];
    lastSync?: { snapshots: number; raised: number } | null;
    busy?: boolean;
    onsync?: () => void;
    onack?: (alertId: string) => void;
  } = $props();

  const PLATFORM = { meta: { label: "Meta", tint: "#3b82f6" }, google: { label: "Google", tint: "#0c8f5a" } };
  const SEV_TINT = { info: "#3b82f6", warning: "#f59e0b", critical: "#ef4444" };
  const money = (c: number) => new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((c || 0) / 100);
  const moneyc = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;
  const num = (n: number) => new Intl.NumberFormat("en", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
  const totalSpend = $derived(campaigns.reduce((a, c) => a + c.spendCents, 0));
  const openAlerts = $derived(alerts.filter((a) => !a.acknowledgedAt));
</script>

<header class="ad-head">
  <Eyebrow>Ads manager</Eyebrow>
  <h1 class="ad-title">Ads Manager</h1>
  <p class="ad-lede">Monitor ad spend across <strong>Meta and Google</strong> in one normalized view. The module stores a connection <strong>reference</strong> — never platform tokens — syncs insight snapshots, and raises <strong>anomaly alerts</strong> when spend or CPC spikes, or money is spent with zero conversions.</p>
  <ol class="ad-how">
    <li><span class="ad-how__n mono">01</span><span><strong>Connect</strong> — reference an upstream ad account; emits <code>ad.account_connected</code>.</span></li>
    <li><span class="ad-how__n mono">02</span><span><strong>Sync</strong> — pull per-campaign insight snapshots; emits <code>ad.insights_synced</code>.</span></li>
    <li><span class="ad-how__n mono">03</span><span><strong>Alert</strong> — anomalies vs the trailing baseline; emits <code>ad.alert_raised</code>.</span></li>
  </ol>
</header>

<section class="ad-top">
  <div class="ad-conns">
    {#each connections as c (c.id)}
      <span class="ad-conn">
        <span class="ad-platform" style={`--tint:${PLATFORM[c.platform].tint}`}>{PLATFORM[c.platform].label}</span>
        <span class="ad-conn__main">
          <span class="ad-conn__name">{c.displayName}</span>
          <span class="ad-conn__acct mono">{c.adAccountId}</span>
        </span>
        <span class="ad-conn__st ad-conn__st--{c.status}">{c.status}</span>
      </span>
    {/each}
  </div>
  <div class="ad-sync">
    <span class="ad-spend"><span class="ad-spend__n">{money(totalSpend)}</span><span class="ad-spend__k">total spend</span></span>
    <Button variant="primary" disabled={busy} onclick={() => onsync?.()}>{busy ? "Syncing…" : "Sync insights"}</Button>
  </div>
</section>
{#if lastSync}
  <p class="ad-syncnote mono">synced {lastSync.snapshots} snapshots · {lastSync.raised} alert{lastSync.raised === 1 ? "" : "s"} raised</p>
{/if}

<section class="ad-table-wrap" aria-label="Campaigns">
  <table class="ad-table">
    <thead>
      <tr><th>Campaign</th><th class="r">Spend</th><th class="r">Impr.</th><th class="r">CTR</th><th class="r">CPC</th><th class="r">Conv.</th><th class="r">ROAS</th></tr>
    </thead>
    <tbody>
      {#each campaigns as c (c.id)}
        <tr class:paused={c.status !== "active"}>
          <td>
            <span class="ad-cpdot" style={`--tint:${PLATFORM[c.platform].tint}`} title={PLATFORM[c.platform].label}></span>
            <span class="ad-cname">{c.name}</span>
            <span class="ad-cstatus mono">{c.status}</span>
          </td>
          <td class="r mono">{moneyc(c.spendCents)}</td>
          <td class="r mono">{num(c.impressions)}</td>
          <td class="r mono">{(c.ctr * 100).toFixed(1)}%</td>
          <td class="r mono">{moneyc(c.cpcCents)}</td>
          <td class="r mono" class:zero={c.conversions === 0}>{c.conversions}</td>
          <td class="r mono">{c.roas != null ? `${c.roas.toFixed(1)}×` : "—"}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<div class="ad-alerts">
  <p class="ad-out__h mono">Alerts <span>({openAlerts.length} open)</span></p>
  {#if alerts.length}
    <ul class="ad-alist">
      {#each alerts as a (a.id)}
        <li class="ad-alert" class:ack={!!a.acknowledgedAt} style={`--tint:${SEV_TINT[a.severity]}`}>
          <span class="ad-alert__sev">{a.severity}</span>
          <span class="ad-alert__main">
            <span class="ad-alert__type mono">{a.type}</span>
            <span class="ad-alert__msg">{a.message}</span>
          </span>
          {#if a.acknowledgedAt}
            <span class="ad-alert__done mono">acknowledged</span>
          {:else}
            <button type="button" class="ad-ack" onclick={() => onack?.(a.id)}>Acknowledge</button>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="ad-empty">No alerts. Sync insights to run anomaly detection.</p>
  {/if}
</div>

<style>
  .ad-head { margin-bottom: 1.5rem; }
  .ad-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .ad-lede { color: var(--color-ink-soft); max-width: 68ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .ad-lede strong { color: var(--color-ink); font-weight: 600; }
  .ad-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 76ch; }
  .ad-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .ad-how strong { color: var(--color-ink); font-weight: 600; }
  .ad-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .ad-how__n { color: var(--color-green); font-size: 0.72rem; }

  .ad-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .ad-conns { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .ad-conn { display: inline-flex; align-items: center; gap: 0.6rem; border: 1px solid var(--color-line-strong); border-radius: 11px; background: var(--color-panel); padding: 0.5rem 0.7rem; }
  .ad-platform { font-family: var(--font-mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tint); background: color-mix(in srgb, var(--tint) 14%, transparent); border: 1px solid color-mix(in srgb, var(--tint) 30%, transparent); border-radius: 6px; padding: 0.15rem 0.4rem; flex: none; }
  .ad-conn__main { display: grid; }
  .ad-conn__name { font-weight: 600; font-size: 0.84rem; }
  .ad-conn__acct { font-size: 0.68rem; color: var(--color-ink-faint); }
  .ad-conn__st { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.15rem 0.4rem; border-radius: 999px; }
  .ad-conn__st--connected { color: #0c8f5a; background: #d8f6e8; }
  .ad-conn__st--error { color: #9b2c2c; background: #fde8e8; }
  .ad-conn__st--disconnected { color: #57606a; background: #e7ebf0; }

  .ad-sync { display: flex; align-items: center; gap: 0.9rem; }
  .ad-spend { display: grid; text-align: right; }
  .ad-spend__n { font-family: var(--font-display); font-weight: 800; font-size: 1.3rem; }
  .ad-spend__k { font-size: 0.68rem; color: var(--color-ink-faint); }
  .ad-syncnote { font-size: 0.74rem; color: var(--color-ink-faint); margin: 0 0 0.9rem; }

  .ad-table-wrap { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); overflow-x: auto; margin-bottom: 1.4rem; }
  .ad-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 540px; }
  .ad-table th { text-align: left; font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-faint); font-weight: 600; padding: 0.7rem 0.8rem; border-bottom: 1px solid var(--color-line-strong); }
  .ad-table th.r, .ad-table td.r { text-align: right; }
  .ad-table td { padding: 0.6rem 0.8rem; border-bottom: 1px solid color-mix(in srgb, var(--color-line-strong) 55%, transparent); }
  .ad-table tbody tr:last-child td { border-bottom: none; }
  .ad-table tr.paused { opacity: 0.55; }
  .ad-cpdot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: var(--tint); margin-right: 0.5rem; vertical-align: middle; }
  .ad-cname { font-weight: 600; }
  .ad-cstatus { font-size: 0.64rem; color: var(--color-ink-faint); margin-left: 0.4rem; text-transform: uppercase; letter-spacing: 0.03em; }
  .ad-table td.zero { color: #9b2c2c; font-weight: 700; }

  .ad-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .ad-empty { color: var(--color-ink-faint); font-size: 0.85rem; }
  .ad-alist { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .ad-alert { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.8rem; border: 1px solid color-mix(in srgb, var(--tint) 32%, var(--color-line-strong)); border-left: 3px solid var(--tint); border-radius: 9px; background: color-mix(in srgb, var(--tint) 5%, var(--color-paper)); padding: 0.55rem 0.75rem; }
  .ad-alert.ack { opacity: 0.55; }
  .ad-alert__sev { font-family: var(--font-mono); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tint); flex: none; }
  .ad-alert__main { display: grid; min-width: 0; }
  .ad-alert__type { font-size: 0.74rem; font-weight: 600; color: var(--color-ink); }
  .ad-alert__msg { font-size: 0.8rem; color: var(--color-ink-soft); }
  .ad-alert__done { font-size: 0.68rem; color: var(--color-ink-faint); }
  .ad-ack { font: inherit; font-size: 0.74rem; background: transparent; border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 7px; padding: 0.3rem 0.55rem; cursor: pointer; }
  .ad-ack:hover { border-color: var(--tint); color: var(--tint); }
</style>
