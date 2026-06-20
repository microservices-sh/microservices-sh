<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Button, Field, Alert, Badge, EmptyState } from "$lib/ui";

  let { data, form } = $props();

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
  <title>Ad connections · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Integrations"
    title="Ad connections"
    description="Connect and manage the ad accounts the ads module monitors. Alerts and insights live on the Ads page."
  />

  {#if form?.connected}
    <Alert tone="success">Ad account connected.</Alert>
  {:else if form?.disconnected}
    <Alert tone="success">Ad account disconnected.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="stack">
    <Card title="Connections">
      {#if data.connections.length > 0}
        <ul class="list" role="list">
          {#each data.connections as conn}
            <li class="list-item row-item">
              <span><strong>{conn.displayName ?? conn.adAccountId}</strong> · {conn.platform}</span>
              <span class="nav" style="align-items: center;">
                <Badge tone={statusTone(conn.status)}>{conn.status}</Badge>
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
        <EmptyState
          title="No ad accounts connected yet"
          description="Connect an account below to start monitoring its spend and anomalies."
        />
      {/if}
    </Card>

    {#if data.canManage}
      <Card title="Connect an account">
        <form method="POST" action="?/connect" use:enhance>
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
      </Card>
    {/if}
  </div>
</main>

<style>
  .stack {
    display: grid;
    gap: 18px;
    margin-block-start: 4px;
    align-items: start;
  }
  .ads-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 720px) {
    .ads-row {
      grid-template-columns: 1fr;
    }
  }
</style>
