<script>
  import { enhance } from "$app/forms";
  import { Alert, Badge, Button, Card, MetricStrip, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  function tone(status) {
    if (status === "ready") return "good";
    if (status === "partial") return "warn";
    return "bad";
  }

  function runLabel(run) {
    if (!run) return "No sync run";
    return `${run.status} · ${run.processedCount} processed`;
  }

  function webhookLabel(receipt) {
    if (!receipt) return "No webhook receipt";
    return `${receipt.topic} · ${receipt.replayed ? "replayed" : "new"}`;
  }

  const metrics = $derived([
    {
      label: "Ready",
      value: data.providers.filter((provider) => provider.status === "ready").length,
      tone: "good",
      hint: "providers"
    },
    {
      label: "Woo connections",
      value: data.wooConnections.length,
      tone: data.wooConnections.length > 0 ? "info" : "neutral",
      hint: "configured"
    },
    {
      label: "Review",
      value: data.providers.filter((provider) => provider.status !== "ready").length,
      tone: "warn",
      hint: "needs setup"
    }
  ]);
</script>

<svelte:head>
  <title>Providers · Commerce Ops</title>
</svelte:head>

<main class="section providers-settings">
  <PageHeader
    eyebrow="Integrations"
    title="Providers"
    description="Read-only readiness for payment, email, and commerce providers used by sync, webhooks, and invoice collection."
  >
    {#snippet actions()}
      <Button href="/app/commerce-sync" variant="ghost">Commerce sync</Button>
      <Button href="/app/settings/webhooks" variant="ghost">Webhook endpoints</Button>
    {/snippet}
  </PageHeader>

  {#if form?.wooTested}
    <Alert tone={form.test.success ? "success" : "warn"}>
      {form.test.connectionName}: {form.test.message}{#if form.test.storeName} · {form.test.storeName}{/if}
    </Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <MetricStrip {metrics} />

  <div class="provider-grid mt-6">
    {#each data.providers as provider (provider.id)}
      <Card>
        <div class="provider-head">
          <div>
            <h2>{provider.label}</h2>
            <p>{provider.summary}</p>
          </div>
          <Badge tone={tone(provider.status)}>{provider.status}</Badge>
        </div>

        <div class="detail-grid mt-4">
          {#each provider.details as detail (detail.label)}
            <div>
              <span>{detail.label}</span>
              <strong>{detail.value}</strong>
              <Badge tone={detail.ok ? "good" : "warn"}>{detail.ok ? "ready" : "review"}</Badge>
            </div>
          {/each}
        </div>

        <div class="secret-list mt-4">
          {#each provider.secrets as secret (secret.name)}
            <div>
              <div>
                <code>{secret.name}</code>
                <p>{secret.purpose}</p>
              </div>
              <Badge tone={secret.configured ? "good" : "bad"}>{secret.configured ? "configured" : "missing"}</Badge>
            </div>
          {/each}
        </div>

        {#if provider.callbackUrl}
          <div class="callback mt-4">
            <span>Webhook callback</span>
            <code>{provider.callbackUrl}</code>
          </div>
        {/if}
      </Card>
    {/each}
  </div>

  <Card class="mt-6" title="WooCommerce connections">
    {#if data.wooConnections.length > 0}
      <div class="connection-list">
        {#each data.wooConnections as connection (connection.id)}
          <div>
            <div class="connection-main">
              <div>
                <strong>{connection.name}</strong>
                <p>{connection.baseUrl ?? "Missing base URL"} · {connection.credentialSource}</p>
              </div>
              <Badge tone={connection.active ? "good" : "neutral"}>{connection.active ? "active" : "inactive"}</Badge>
            </div>
            <dl>
              <div><dt>Credentials</dt><dd><Badge tone={connection.credentialsConfigured ? "good" : "bad"}>{connection.credentialsConfigured ? "configured" : "missing"}</Badge></dd></div>
              <div><dt>Latest run</dt><dd>{runLabel(connection.latestRun)}</dd></div>
              <div><dt>Latest webhook</dt><dd>{webhookLabel(connection.latestWebhook)}</dd></div>
              <div><dt>Webhook URL</dt><dd><code>{connection.webhookUrl}</code></dd></div>
            </dl>
            {#if data.canManage}
              <form method="POST" action="?/testWooCommerceConnection" use:enhance>
                <input type="hidden" name="connectionId" value={connection.id} />
                <Button type="submit" variant="ghost" size="sm" disabled={!connection.active || !connection.baseUrl}>Test connection</Button>
              </form>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">No WooCommerce connections configured.</p>
    {/if}
  </Card>
</main>

<style>
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .provider-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .provider-head h2 {
    font-size: 1rem;
    letter-spacing: 0;
  }
  .provider-head p,
  .secret-list p,
  .callback span,
  .connection-list p,
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.86rem;
  }
  .detail-grid {
    display: grid;
    gap: 10px;
  }
  .detail-grid div,
  .secret-list div,
  .callback,
  .connection-list > div {
    border: 1px solid var(--color-line);
    border-radius: 8px;
    padding: 10px;
    min-width: 0;
  }
  .detail-grid div {
    display: grid;
    gap: 6px;
  }
  .detail-grid span,
  .callback span,
  dt {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .detail-grid strong,
  .callback code,
  .secret-list code,
  dd code {
    overflow-wrap: anywhere;
  }
  .secret-list,
  .connection-list {
    display: grid;
    gap: 8px;
  }
  .secret-list > div,
  .connection-main,
  dl div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .callback {
    display: grid;
    gap: 6px;
  }
  dl {
    display: grid;
    gap: 8px;
    margin: 12px 0;
  }
  dt,
  dd {
    margin: 0;
  }
  dd {
    min-width: 0;
    text-align: right;
  }
  @media (max-width: 1100px) {
    .provider-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 640px) {
    .secret-list > div,
    .connection-main,
    dl div {
      align-items: flex-start;
      flex-direction: column;
    }
    dd {
      text-align: left;
    }
  }
</style>
