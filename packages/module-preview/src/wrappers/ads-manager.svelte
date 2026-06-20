<script lang="ts">
  // Interactive wrapper for the ads-manager module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real use
  // cases: syncInsights (records snapshots → ad.insights_synced) and detectAnomalies
  // (spend_spike ≥ mult × trailing avg → critical; cpc_spike → warning; zero_conv
  // when spend ≥ min with 0 conversions → warning → ad.alert_raised). Connections are
  // references; the upstream service holds the platform tokens.
  import Preview from "@microservices-sh/ads-manager/preview";

  let { module: m }: { module: any } = $props();

  const connections = [
    { id: "cn_meta", platform: "meta", displayName: "Acme — Meta", adAccountId: "act_889201", status: "connected" },
    { id: "cn_goog", platform: "google", displayName: "Acme — Google", adAccountId: "123-456-7890", status: "connected" }
  ];

  // baseline trailing averages per campaign (cents), used by anomaly detection
  const SPEND_MULT = 3, CPC_MULT = 2, ZERO_CONV_MIN = 5000;
  let campaigns = $state<any[]>([
    { id: "c1", platform: "meta", name: "Retargeting — warm", status: "active", spendCents: 8200, impressions: 42000, clicks: 910, ctr: 0.0217, cpcCents: 90, conversions: 24, roas: 3.4, _avgSpend: 8000, _avgCpc: 88 },
    { id: "c2", platform: "google", name: "Brand — search", status: "active", spendCents: 5400, impressions: 18000, clicks: 640, ctr: 0.0356, cpcCents: 84, conversions: 31, roas: 5.1, _avgSpend: 5200, _avgCpc: 82 },
    { id: "c3", platform: "meta", name: "Prospecting — broad", status: "active", spendCents: 11200, impressions: 96000, clicks: 1340, ctr: 0.014, cpcCents: 84, conversions: 9, roas: 1.2, _avgSpend: 10800, _avgCpc: 80 },
    { id: "c4", platform: "google", name: "Display — remarketing", status: "paused", spendCents: 0, impressions: 0, clicks: 0, ctr: 0, cpcCents: 0, conversions: 0, _avgSpend: 1200, _avgCpc: 60 }
  ]);
  let alerts = $state<any[]>([]);
  let lastSync = $state<any>(null);
  let aSeq = 1;
  let synced = 0;

  // Scripted next-day deltas that trigger each anomaly type on the 1st sync.
  const SYNCS: Record<string, { spendCents: number; cpcCents: number; conversions: number; clicks: number; impressions: number }>[] = [
    {
      c1: { spendCents: 9000, cpcCents: 95, conversions: 26, clicks: 950, impressions: 44000 },
      c2: { spendCents: 5600, cpcCents: 180, conversions: 20, clicks: 310, impressions: 17000 }, // CPC spike
      c3: { spendCents: 36000, cpcCents: 110, conversions: 7, clicks: 1500, impressions: 120000 }, // spend spike + low conv
      c4: { spendCents: 6200, cpcCents: 70, conversions: 0, clicks: 88, impressions: 9000 }       // zero-conv spend
    }
  ];

  function onsync() {
    const batch = SYNCS[Math.min(synced, SYNCS.length - 1)];
    const fresh: any[] = [];
    campaigns = campaigns.map((c) => {
      const d = batch[c.id];
      if (!d) return c;
      const ctr = d.impressions ? d.clicks / d.impressions : 0;
      const roas = c.roas != null ? Math.max(0.5, c.roas * (d.conversions / Math.max(1, c.conversions))) : undefined;
      // anomaly detection vs trailing baseline (mirrors detectAnomalies)
      if (c._avgSpend > 0 && d.spendCents >= SPEND_MULT * c._avgSpend)
        fresh.push({ id: `al_${aSeq++}`, type: "spend_spike", severity: "critical", message: `${c.name} spend ${(d.spendCents / c._avgSpend).toFixed(1)}× trailing avg`, firedAt: new Date().toISOString(), acknowledgedAt: null });
      if (c._avgCpc > 0 && d.cpcCents >= CPC_MULT * c._avgCpc)
        fresh.push({ id: `al_${aSeq++}`, type: "cpc_spike", severity: "warning", message: `${c.name} CPC ${(d.cpcCents / c._avgCpc).toFixed(1)}× trailing avg`, firedAt: new Date().toISOString(), acknowledgedAt: null });
      if (d.spendCents >= ZERO_CONV_MIN && d.conversions === 0)
        fresh.push({ id: `al_${aSeq++}`, type: "zero_conv", severity: "warning", message: `${c.name} spent with zero conversions`, firedAt: new Date().toISOString(), acknowledgedAt: null });
      return { ...c, spendCents: d.spendCents, cpcCents: d.cpcCents, conversions: d.conversions, clicks: d.clicks, impressions: d.impressions, ctr, roas, status: c.status === "paused" && d.spendCents > 0 ? "active" : c.status };
    });
    alerts = [...fresh, ...alerts];
    synced += 1;
    lastSync = { snapshots: Object.keys(batch).length, raised: fresh.length };
  }
  function onack(id: string) {
    alerts = alerts.map((a) => (a.id === id ? { ...a, acknowledgedAt: new Date().toISOString() } : a));
  }
</script>

<Preview {connections} {campaigns} {alerts} {lastSync} {onsync} {onack} />
