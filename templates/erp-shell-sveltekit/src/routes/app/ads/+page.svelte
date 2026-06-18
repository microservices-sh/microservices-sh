<script lang="ts">
  import { enhance } from "$app/forms";
  import { Card, Eyebrow, Badge, Button, Field, Alert } from "$lib/ui";

  let { data, form } = $props();

  const when = (iso: string) => new Date(iso).toLocaleDateString();

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
</script>

<svelte:head>
  <title>Ads · ERP Shell</title>
</svelte:head>

<main class="section">
  <Eyebrow>Ad monitoring</Eyebrow>
  <h1>Ads</h1>
  <p>Connected ad accounts and anomaly alerts, powered by the ads-manager module.</p>

  {#if form?.connected}
    <Alert tone="success">Ad account connected.</Alert>
  {:else if form?.disconnected}
    <Alert tone="success">Ad account disconnected.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card>
      <h2>Connections</h2>
      {#if data.connections.length > 0}
        <ul class="list" role="list">
          {#each data.connections as conn}
            <li class="list-item row-item">
              <span><strong>{conn.displayName ?? conn.adAccountId}</strong> · {conn.platform}</span>
              <span class="nav" style="align-items: center;">
                <Badge tone={conn.status === "active" ? "good" : "neutral"}>{conn.status}</Badge>
                {#if data.canManage}
                  <form method="POST" action="?/disconnect" use:enhance>
                    <input type="hidden" name="connectionId" value={conn.id} />
                    <Button type="submit" variant="ghost" size="sm">Disconnect</Button>
                  </form>
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No ad accounts connected yet.</p>
      {/if}

      {#if data.canManage}
        <form method="POST" action="?/connect" use:enhance class="mt-4">
          <div class="ads-row">
            <Field label="Platform" id="platform">
              <select id="platform" name="platform"><option value="meta">Meta</option><option value="google">Google</option></select>
            </Field>
            <Field label="Ad account id" id="adAccountId"><input id="adAccountId" name="adAccountId" required placeholder="act_123456" /></Field>
          </div>
          <Field label="Display name (optional)" id="displayName"><input id="displayName" name="displayName" placeholder="Q3 Brand" /></Field>
          <Field label="Upstream connection ref" id="externalRef"><input id="externalRef" name="externalRef" required placeholder="conn_… (from the ads service OAuth)" /></Field>
          <Button type="submit" variant="primary">Connect account</Button>
        </form>
      {/if}
    </Card>

    <Card>
      <h2>Alerts</h2>
      {#if data.alerts.length > 0}
        <ul class="list" role="list">
          {#each data.alerts as alert}
            <li class="list-item alert-item">
              <Badge tone={sevTone(alert.severity)}>{alert.severity}</Badge>
              <span class="alert-msg">{alert.message}</span>
              <span class="alert-meta">{when(alert.createdAt)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No alerts. Anomalies raised against connected accounts appear here.</p>
      {/if}
    </Card>
  </div>
</main>

<style>
  .ads-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
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
</style>
