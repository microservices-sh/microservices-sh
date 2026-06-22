<script>
  import { Badge, Button, Card, MetricStrip, PageHeader } from "$lib/ui";

  let { data } = $props();

  function tone(status) {
    if (status === "ready") return "good";
    if (status === "partial") return "warn";
    return "bad";
  }

  const metrics = $derived([
    {
      label: "Provider ready",
      value: data.providers.filter((provider) => provider.status === "ready").length,
      tone: "good",
      hint: "configured"
    },
    {
      label: "Payment links",
      value: data.paymentLinks.linkedInvoices,
      tone: data.paymentLinks.linkedInvoices > 0 ? "info" : "neutral",
      hint: `${data.paymentLinks.openWithoutLink} open without link`
    },
    {
      label: "Webhook failures",
      value: data.outboundWebhooks.failedDeliveries,
      tone: data.outboundWebhooks.failedDeliveries > 0 ? "bad" : "good",
      hint: "latest 25"
    }
  ]);
</script>

<svelte:head>
  <title>Provider readiness · Accounting ERP</title>
</svelte:head>

<main class="section providers-settings">
  <PageHeader
    eyebrow="Integrations"
    title="Provider readiness"
    description="Read-only readiness for payment links, payment webhooks, email delivery, and outbound webhook providers."
  >
    {#snippet actions()}
      <Button href="/app/settings/accounting" variant="ghost">Accounting setup</Button>
      <Button href="/app/settings/webhooks" variant="ghost">Webhook endpoints</Button>
      <Button href="/app/webhooks" variant="ghost">Delivery log</Button>
    {/snippet}
  </PageHeader>

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
                <strong>{secret.name}</strong>
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

  <div class="readiness-grid mt-6">
    <Card title="Payment links">
      <div class="detail-grid">
        <div><span>Total invoices</span><strong>{data.paymentLinks.totalInvoices}</strong></div>
        <div><span>Open invoices</span><strong>{data.paymentLinks.openInvoices}</strong></div>
        <div><span>With links</span><strong>{data.paymentLinks.linkedInvoices}</strong></div>
        <div><span>Open without link</span><strong>{data.paymentLinks.openWithoutLink}</strong></div>
      </div>
      <div class="provider-breakdown mt-4">
        {#if data.paymentLinks.providerBreakdown.length > 0}
          {#each data.paymentLinks.providerBreakdown as item (item.provider)}
            <div><span>{item.provider}</span><strong>{item.count}</strong></div>
          {/each}
        {:else}
          <p class="empty">No payment links have been created.</p>
        {/if}
      </div>
      <p class="note">Latest link: {data.paymentLinks.latestCreatedAt ?? "none"}</p>
    </Card>

    <Card title="Payment webhook">
      <div class="detail-grid">
        <div><span>Webhook secret</span><strong>{data.stripe.webhookConfigured ? "Configured" : "Missing"}</strong></div>
        <div><span>Key mode</span><strong>{data.stripe.keyMode}</strong></div>
        <div><span>Deposit routing</span><strong>{data.depositRouting.status}</strong></div>
      </div>
      <div class="callback mt-4">
        <span>Webhook route</span>
        <code>{data.stripe.webhookUrl}</code>
      </div>
      <div class="event-list mt-4">
        <span>Accepted events</span>
        {#each data.stripe.acceptedEvents as eventName (eventName)}
          <code>{eventName}</code>
        {/each}
        <span>Required metadata</span>
        <code>{data.stripe.requiredMetadata}</code>
      </div>
    </Card>

    <Card title="Email delivery">
      <div class="detail-grid">
        <div><span>Provider</span><strong>{data.email.providerId}</strong></div>
        <div><span>Sender</span><strong>{data.email.from}</strong></div>
        <div><span>Recent</span><strong>{data.email.recentCount}</strong></div>
        <div><span>Sent</span><strong>{data.email.sent}</strong></div>
        <div><span>Queued</span><strong>{data.email.queued}</strong></div>
        <div><span>Failed</span><strong>{data.email.failed}</strong></div>
      </div>
      {#if data.email.usesDefaultFrom}
        <p class="note warn">Default sender is still in use.</p>
      {:else}
        <p class="note">Latest email: {data.email.latestAt ?? "none"}</p>
      {/if}
    </Card>

    <Card title="Outbound webhooks">
      <div class="detail-grid">
        <div><span>Endpoints</span><strong>{data.outboundWebhooks.endpointCount}</strong></div>
        <div><span>Active</span><strong>{data.outboundWebhooks.activeEndpointCount}</strong></div>
        <div><span>Recent attempts</span><strong>{data.outboundWebhooks.recentDeliveries}</strong></div>
        <div><span>Failed</span><strong>{data.outboundWebhooks.failedDeliveries}</strong></div>
      </div>
      <p class="note">Latest delivery: {data.outboundWebhooks.latestAt ?? "none"}</p>
      <div class="link-row mt-4">
        <Button href="/app/settings/webhooks" size="sm" variant="ghost">Configure endpoints</Button>
        <Button href="/app/webhooks" size="sm" variant="ghost">View delivery log</Button>
      </div>
    </Card>
  </div>
</main>

<style>
  .provider-grid,
  .readiness-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  .event-list span,
  .empty,
  .note {
    color: var(--color-ink-faint);
    font-size: 0.86rem;
  }
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .detail-grid div,
  .secret-list div,
  .callback,
  .event-list,
  .provider-breakdown div {
    border: 1px solid var(--color-line);
    border-radius: 8px;
    padding: 10px;
    min-width: 0;
  }
  .detail-grid div,
  .callback,
  .event-list,
  .provider-breakdown div {
    display: grid;
    gap: 6px;
  }
  .detail-grid span,
  .callback span,
  .event-list span,
  .provider-breakdown span {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .detail-grid strong,
  .callback code,
  .event-list code,
  .provider-breakdown strong {
    overflow-wrap: anywhere;
  }
  .secret-list,
  .provider-breakdown {
    display: grid;
    gap: 8px;
  }
  .secret-list > div,
  .link-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .note {
    margin-block: 12px 0;
  }
  .note.warn {
    color: var(--color-amber);
  }
  .link-row {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  @media (max-width: 1100px) {
    .detail-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 860px) {
    .provider-grid,
    .readiness-grid,
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 560px) {
    .secret-list > div {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
