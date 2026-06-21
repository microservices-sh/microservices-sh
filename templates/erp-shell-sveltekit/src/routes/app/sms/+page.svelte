<script lang="ts">
  import { enhance } from "$app/forms";
  import { Alert, Badge, Button, Card, EmptyState, Field, MetricStrip, PageHeader, ResourceTable } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data, form } = $props();

  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "n/a");
  const money = (cents: number) => currency.format(cents / 100);

  const optedInContacts = $derived(data.contacts.filter((contact) => contact.optIn));
  const totalSent = $derived(data.campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0));
  const totalDelivered = $derived(data.campaigns.reduce((sum, campaign) => sum + campaign.deliveredCount, 0));
  const totalCostCents = $derived(data.campaigns.reduce((sum, campaign) => sum + campaign.totalCostCents, 0));
  const dispatchableCampaigns = $derived(
    data.campaigns.filter((campaign) => campaign.status !== "completed" && campaign.status !== "cancelled")
  );

  const metrics = $derived<Metric[]>([
    {
      label: "Opted in",
      value: optedInContacts.length,
      tone: optedInContacts.length > 0 ? "good" : "warn",
      hint: `${data.contacts.length} contacts`
    },
    {
      label: "Campaigns",
      value: data.campaigns.length,
      tone: data.campaigns.some((campaign) => campaign.status === "failed") ? "bad" : "neutral",
      hint: `${dispatchableCampaigns.length} dispatchable`
    },
    { label: "Sent", value: totalSent, tone: totalSent > 0 ? "info" : "neutral", hint: `${totalDelivered} delivered` },
    { label: "Spend", value: money(totalCostCents), tone: "neutral", hint: "preview provider cost" }
  ]);

  function campaignTone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "completed":
        return "good";
      case "failed":
      case "cancelled":
        return "bad";
      case "scheduled":
      case "sending":
        return "warn";
      default:
        return "neutral";
    }
  }

  function recipientTone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "sent":
      case "delivered":
        return "good";
      case "failed":
        return "bad";
      case "queued":
      case "pending":
        return "warn";
      default:
        return "neutral";
    }
  }
</script>

<svelte:head>
  <title>SMS | ERP Shell</title>
</svelte:head>

<main class="section sms-page">
  <PageHeader
    eyebrow="Outbound messaging"
    title="SMS"
    description="Contacts, templates, provider setup, and campaign dispatch powered by the sms-campaigns module."
  >
    {#snippet meta()}
      <Badge tone={data.status.status === "draft" ? "warn" : "good"}>{data.status.status}</Badge>
      <span>{data.status.id}</span>
    {/snippet}
  </PageHeader>

  {#if form?.contactCreated}
    <Alert tone="success">Contact saved.</Alert>
  {:else if form?.templateCreated}
    <Alert tone="success">Template created.</Alert>
  {:else if form?.providerConfigured}
    <Alert tone="success">Provider configured.</Alert>
  {:else if form?.campaignCreated}
    <Alert tone="success">Campaign created.</Alert>
  {:else if form?.campaignDispatched}
    <Alert tone="success">Campaign dispatched.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <MetricStrip {metrics} />

  <div class="grid">
    <section class="grid__main">
      <Card title="Campaigns">
        {#snippet header()}
          <Badge tone="neutral">{data.campaigns.length}</Badge>
        {/snippet}

        {#if data.campaigns.length > 0}
          <ResourceTable class="flush" caption="SMS campaigns">
            {#snippet head()}
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th class="table-num">Recipients</th>
                <th class="table-num">Delivered</th>
                <th class="table-num">Cost</th>
                <th></th>
              </tr>
            {/snippet}
            {#each data.campaigns as campaign (campaign.id)}
              <tr>
                <td data-label="Name">
                  <span class="table-primary">{campaign.name}</span>
                  <span class="table-muted">{campaign.vendor} - {campaign.sendType} - {when(campaign.scheduledAt)}</span>
                </td>
                <td data-label="Status"><Badge tone={campaignTone(campaign.status)}>{campaign.status}</Badge></td>
                <td data-label="Recipients" class="table-num">{campaign.totalContacts}</td>
                <td data-label="Delivered" class="table-num">{campaign.deliveredCount}</td>
                <td data-label="Cost" class="table-num">{money(campaign.totalCostCents)}</td>
                <td class="table-action">
                  <a class:is-active={data.selectedCampaignId === campaign.id} href={`/app/sms?campaign=${campaign.id}`}>
                    Report
                  </a>
                </td>
              </tr>
            {/each}
          </ResourceTable>
        {:else}
          <EmptyState title="No campaigns yet" description="Create a campaign after adding contacts and a provider." />
        {/if}
      </Card>

      <Card title="Contacts" class="stack">
        {#snippet header()}
          <Badge tone="neutral">{data.contacts.length}</Badge>
        {/snippet}

        {#if data.contacts.length > 0}
          <ResourceTable class="flush" caption="SMS contacts">
            {#snippet head()}
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Consent</th>
                <th>Tags</th>
              </tr>
            {/snippet}
            {#each data.contacts as contact (contact.id)}
              <tr>
                <td data-label="Name" class="table-primary">{contact.name}</td>
                <td data-label="Phone" class="table-muted">{contact.phone}</td>
                <td data-label="Consent">
                  <Badge tone={contact.optIn ? "good" : "warn"}>{contact.optIn ? "opted in" : "opted out"}</Badge>
                </td>
                <td data-label="Tags" class="tag-cell">
                  {#if contact.tags.length > 0}
                    {#each contact.tags as tag (tag)}<Badge tone="neutral">{tag}</Badge>{/each}
                  {:else}
                    <span class="table-muted">none</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </ResourceTable>
        {:else}
          <EmptyState title="No contacts yet" description="Opted-in SMS contacts appear here." />
        {/if}
      </Card>

      <Card title="Campaign report" class="stack">
        {#snippet header()}
          {#if data.report}<Badge tone={campaignTone(data.report.campaign.status)}>{data.report.campaign.status}</Badge>{/if}
        {/snippet}

        {#if data.report}
          <div class="report-summary">
            <div>
              <span>Sent</span>
              <strong>{data.report.campaign.sentCount}</strong>
            </div>
            <div>
              <span>Delivered</span>
              <strong>{data.report.campaign.deliveredCount}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{data.report.campaign.failedCount}</strong>
            </div>
            <div>
              <span>Cost</span>
              <strong>{money(data.report.campaign.totalCostCents)}</strong>
            </div>
          </div>

          {#if data.report.recipients.length > 0}
            <ResourceTable caption="SMS campaign recipients">
              {#snippet head()}
                <tr>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Vendor message</th>
                  <th class="table-num">Cost</th>
                </tr>
              {/snippet}
              {#each data.report.recipients as recipient (recipient.id)}
                <tr>
                  <td data-label="Phone" class="table-primary">{recipient.phone}</td>
                  <td data-label="Status"><Badge tone={recipientTone(recipient.status)}>{recipient.status}</Badge></td>
                  <td data-label="Vendor message" class="table-muted">{recipient.vendorMessageId ?? "pending"}</td>
                  <td data-label="Cost" class="table-num">{money(recipient.costCents)}</td>
                </tr>
              {/each}
            </ResourceTable>
          {:else}
            <EmptyState title="No recipients" description="Recipients are added when a campaign is created." />
          {/if}
        {:else}
          <EmptyState title="No report selected" description="Select a campaign report from the campaign table." />
        {/if}
      </Card>
    </section>

    <aside class="grid__side">
      {#if data.canManage}
        <Card title="Create contact">
          <form method="POST" action="?/createContact" use:enhance>
            <Field label="Name" id="sms-contact-name" required><input id="sms-contact-name" name="name" required /></Field>
            <Field label="Phone" id="sms-contact-phone" required>
              <input id="sms-contact-phone" name="phone" required placeholder="+1 555 0101" />
            </Field>
            <Field label="Email" id="sms-contact-email"><input id="sms-contact-email" name="email" type="email" /></Field>
            <Field label="Tags" id="sms-contact-tags" hint="Comma separated.">
              <input id="sms-contact-tags" name="tags" placeholder="vip, reminders" />
            </Field>
            <label class="check-row"><input type="checkbox" name="optIn" checked /> Opted in</label>
            <Button type="submit" variant="primary">Save contact</Button>
          </form>
        </Card>

        <Card title="Create template" class="stack">
          <form method="POST" action="?/createTemplate" use:enhance>
            <Field label="Name" id="sms-template-name" required><input id="sms-template-name" name="name" required /></Field>
            <Field label="Message" id="sms-template-content" required>
              <textarea id="sms-template-content" name="content" rows="4" required></textarea>
            </Field>
            <Button type="submit" variant="primary">Create template</Button>
          </form>
        </Card>

        <Card title="Provider" class="stack">
          <form method="POST" action="?/configureProvider" use:enhance>
            <Field label="Vendor" id="sms-provider-vendor" required>
              <select id="sms-provider-vendor" name="vendor" required>
                <option value="memory">Memory</option>
                <option value="twilio">Twilio</option>
                <option value="clicksend">ClickSend</option>
                <option value="sns">Amazon SNS</option>
              </select>
            </Field>
            <Field label="Sender ID" id="sms-provider-sender" required>
              <input id="sms-provider-sender" name="senderId" required value="StackSuite" />
            </Field>
            <Field label="Secret reference" id="sms-provider-secret">
              <input id="sms-provider-secret" name="apiKeyRef" placeholder="secret:SMS_TWILIO_TOKEN" />
            </Field>
            <div class="check-grid">
              <label class="check-row"><input type="checkbox" name="isEnabled" checked /> Enabled</label>
              <label class="check-row"><input type="checkbox" name="isDefault" checked /> Default</label>
            </div>
            <Button type="submit" variant="primary">Save provider</Button>
          </form>
        </Card>

        <Card title="Create campaign" class="stack">
          <form method="POST" action="?/createCampaign" use:enhance>
            <Field label="Name" id="sms-campaign-name" required><input id="sms-campaign-name" name="name" required /></Field>
            <div class="form-row">
              <Field label="Vendor" id="sms-campaign-vendor" required>
                <select id="sms-campaign-vendor" name="vendor" required>
                  {#if data.providers.length > 0}
                    {#each data.providers as provider (provider.id)}
                      <option value={provider.vendor}>{provider.vendor} ({provider.senderId})</option>
                    {/each}
                  {:else}
                    <option value="memory">memory (demo)</option>
                  {/if}
                </select>
              </Field>
              <Field label="Send type" id="sms-campaign-type" required>
                <select id="sms-campaign-type" name="sendType" required>
                  <option value="scheduled">Scheduled</option>
                  <option value="immediate">Immediate</option>
                </select>
              </Field>
            </div>
            <Field label="Template" id="sms-campaign-template">
              <select id="sms-campaign-template" name="templateId">
                <option value="">Use message text</option>
                {#each data.templates as template (template.id)}
                  <option value={template.id}>{template.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Message override" id="sms-campaign-message">
              <textarea id="sms-campaign-message" name="message" rows="4"></textarea>
            </Field>
            <Field label="Scheduled at" id="sms-campaign-scheduled">
              <input id="sms-campaign-scheduled" name="scheduledAt" type="datetime-local" />
            </Field>
            <Field label="Contacts" id="sms-campaign-contacts" required>
              <select id="sms-campaign-contacts" name="contactIds" multiple size="5" required>
                {#each optedInContacts as contact (contact.id)}
                  <option value={contact.id}>{contact.name} - {contact.phone}</option>
                {/each}
              </select>
            </Field>
            <Button type="submit" variant="primary" disabled={optedInContacts.length === 0}>Create campaign</Button>
          </form>
        </Card>

        <Card title="Dispatch" class="stack">
          <form method="POST" action="?/dispatchCampaign" use:enhance>
            <Field label="Campaign" id="sms-dispatch-campaign" required>
              <select id="sms-dispatch-campaign" name="campaignId" required>
                {#each dispatchableCampaigns as campaign (campaign.id)}
                  <option value={campaign.id}>{campaign.name} - {campaign.status}</option>
                {/each}
              </select>
            </Field>
            <Button type="submit" variant="primary" disabled={dispatchableCampaigns.length === 0}>
              Dispatch preview
            </Button>
          </form>
        </Card>
      {:else}
        <Card title="Access">
          <p class="muted">Your role can read SMS campaigns. A teammate with member.manage can change contacts, providers, and dispatches.</p>
        </Card>
      {/if}

      <Card title="Providers" class="stack">
        {#if data.providers.length > 0}
          <ul class="provider-list" role="list">
            {#each data.providers as provider (provider.id)}
              <li>
                <div>
                  <strong>{provider.vendor}</strong>
                  <span>{provider.senderId}</span>
                </div>
                <Badge tone={provider.isEnabled ? "good" : "warn"}>{provider.isEnabled ? "enabled" : "disabled"}</Badge>
              </li>
            {/each}
          </ul>
        {:else}
          <EmptyState title="No provider" description="Configure a provider before dispatching campaigns." />
        {/if}
      </Card>
    </aside>
  </div>
</main>

<style>
  .sms-page :global(.card__body) {
    min-width: 0;
  }
  .grid {
    display: grid;
    gap: 18px;
    margin-block-start: 22px;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr);
    align-items: start;
  }
  .grid__main,
  .grid__side {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  :global(.card.stack) {
    margin: 0;
  }
  .table-primary {
    display: block;
  }
  .tag-cell,
  .check-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .report-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-block-end: 16px;
  }
  .report-summary div {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: 11px 12px;
    background: var(--color-panel-subtle);
  }
  .report-summary span,
  .provider-list span,
  .muted {
    color: var(--color-ink-faint);
    font-size: 0.82rem;
  }
  .report-summary strong {
    display: block;
    margin-block-start: 4px;
    font-size: 1.1rem;
    font-variant-numeric: tabular-nums;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .check-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-block-end: 14px;
    font-size: 0.86rem;
    color: var(--color-ink-soft);
  }
  .check-row input {
    inline-size: 16px;
    block-size: 16px;
    accent-color: var(--color-act);
  }
  .provider-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 10px;
  }
  .provider-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: 10px 12px;
  }
  .provider-list strong,
  .provider-list span {
    display: block;
  }
  a.is-active {
    color: var(--color-act);
    font-weight: 650;
  }
  @media (max-width: 960px) {
    .grid,
    .form-row,
    .report-summary {
      grid-template-columns: 1fr;
    }
  }
</style>
