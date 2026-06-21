<script lang="ts">
  import { enhance } from "$app/forms";
  import { money } from "$lib/format";
  import { Alert, Badge, Button, Card, EmptyState, Field, MetricStrip, PageHeader, ResourceTable } from "$lib/ui";
  import type { Metric, Tone } from "$lib/ui/types";

  let { data, form } = $props();

  const selected = $derived(data.selectedTemplate);
  const generatedDrafts = $derived(form?.generatedDrafts ?? []);
  const metrics = $derived<Metric[]>([
    { label: "Active", value: data.stats.active, tone: data.stats.active > 0 ? "good" : "neutral", hint: `${data.stats.paused} paused` },
    { label: "Due value", value: money(data.stats.dueValueCents), tone: data.stats.dueValueCents > 0 ? "warn" : "neutral", hint: "Ready to draft" },
    { label: "Portfolio", value: money(data.stats.totalValueCents), tone: "info", hint: `${data.templates.length} schedules` },
    { label: "Completed", value: data.stats.completed, tone: data.stats.completed > 0 ? "neutral" : "info", hint: `${data.stats.cancelled} cancelled` }
  ]);

  const typeFilters = [
    { id: "all", label: "All", href: "/app/recurring-documents" },
    { id: "invoice", label: "Invoices", href: "/app/recurring-documents?type=invoice" },
    { id: "bill", label: "Bills", href: "/app/recurring-documents?type=bill" }
  ];

  const statusFilters = [
    { id: "active", label: "Active", href: "/app/recurring-documents?status=active" },
    { id: "paused", label: "Paused", href: "/app/recurring-documents?status=paused" },
    { id: "completed", label: "Completed", href: "/app/recurring-documents?status=completed" }
  ];

  function tone(status: string): Tone {
    switch (status) {
      case "active":
        return "good";
      case "paused":
        return "warn";
      case "cancelled":
        return "bad";
      default:
        return "neutral";
    }
  }

  function dateLabel(value: string | null): string {
    if (!value) return "No date";
    return new Date(value).toLocaleDateString();
  }
</script>

<svelte:head>
  <title>Document schedules - Accounting ERP</title>
</svelte:head>

<main class="section recurring-documents-page">
  <PageHeader
    eyebrow="Recurring documents"
    title="Document schedules"
    description="Create recurring invoice and bill schedules, generate due draft payloads, and review lifecycle state before persisting final documents."
  >
    {#snippet actions()}
      <Button href="/app/invoices/recurring" variant="ghost">Invoice recurring</Button>
    {/snippet}
  </PageHeader>

  {#if form?.templateCreated}
    <Alert tone="success">Schedule created.</Alert>
  {:else if form?.paused}
    <Alert tone="warn">Schedule paused.</Alert>
  {:else if form?.resumed}
    <Alert tone="success">Schedule resumed.</Alert>
  {:else if form?.cancelled}
    <Alert tone="warn">Schedule cancelled.</Alert>
  {:else if form?.generatedDue}
    <Alert tone="success">{generatedDrafts.length} due draft{generatedDrafts.length === 1 ? "" : "s"} generated for review.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <MetricStrip {metrics} />

  <div class="schedule-toolbar">
    {#each typeFilters as filter (filter.id)}
      <a class:active={data.activeType === filter.id} href={filter.href}>{filter.label}</a>
    {/each}
    {#each statusFilters as filter (filter.id)}
      <a class:active={data.activeStatus === filter.id} href={filter.href}>{filter.label}</a>
    {/each}
    <Badge tone="neutral">{data.status.status}</Badge>
  </div>

  <div class="schedule-grid mt-6">
    <Card title="Schedules">
      {#snippet header()}
        <Badge tone="neutral">{data.templates.length}</Badge>
      {/snippet}

      {#if data.templates.length > 0}
        <ResourceTable class="flush" caption="Recurring document schedules">
          {#snippet head()}
            <tr>
              <th>Schedule</th>
              <th>Party</th>
              <th>Status</th>
              <th>Next run</th>
              <th class="table-num">Total</th>
              <th></th>
            </tr>
          {/snippet}
          {#each data.templates as template (template.id)}
            <tr>
              <td data-label="Schedule">
                <a class="table-primary" href={`/app/recurring-documents?template=${template.id}`}>{template.name}</a>
                <div class="table-muted">{template.documentType} - {template.frequency}</div>
              </td>
              <td data-label="Party">{template.partyName}</td>
              <td data-label="Status"><Badge tone={tone(template.status)}>{template.status}</Badge></td>
              <td data-label="Next run">{dateLabel(template.nextRunDate)}</td>
              <td data-label="Total" class="table-num">{money(template.totalCents, template.currency)}</td>
              <td class="table-action">
                {#if data.canManage}
                  <div class="row-actions">
                    {#if template.status === "active"}
                      <form method="POST" action="?/pauseTemplate" use:enhance>
                        <input type="hidden" name="templateId" value={template.id} />
                        <Button type="submit" size="sm" variant="ghost">Pause</Button>
                      </form>
                    {:else if template.status === "paused"}
                      <form method="POST" action="?/resumeTemplate" use:enhance>
                        <input type="hidden" name="templateId" value={template.id} />
                        <Button type="submit" size="sm" variant="primary">Resume</Button>
                      </form>
                    {/if}
                    {#if template.status !== "cancelled" && template.status !== "completed"}
                      <form method="POST" action="?/cancelTemplate" use:enhance>
                        <input type="hidden" name="templateId" value={template.id} />
                        <Button type="submit" size="sm" variant="ghost">Cancel</Button>
                      </form>
                    {/if}
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </ResourceTable>
      {:else}
        <EmptyState title="No schedules yet" description="Recurring invoice and bill schedules will appear here." />
      {/if}
    </Card>

    <Card title={selected ? "Selected schedule" : "Draft payloads"}>
      {#if generatedDrafts.length > 0}
        <div class="draft-stack">
          {#each generatedDrafts as draft (draft.id)}
            <div class="draft-card">
              <div>
                <strong>{draft.sourceTemplateName}</strong>
                <p>{draft.documentType} draft - {money(draft.totalCents, draft.currency)}</p>
              </div>
              <Badge tone={draft.status === "approved" ? "good" : "neutral"}>{draft.status}</Badge>
            </div>
          {/each}
        </div>
      {:else if selected}
        <div class="selected-head">
          <div>
            <strong>{selected.name}</strong>
            <p>{selected.partyName} - {money(selected.totalCents, selected.currency)}</p>
          </div>
          <Badge tone={tone(selected.status)}>{selected.status}</Badge>
        </div>

        <dl class="schedule-summary">
          <div><dt>Document</dt><dd>{selected.documentType}</dd></div>
          <div><dt>Frequency</dt><dd>{selected.frequency}</dd></div>
          <div><dt>Start</dt><dd>{dateLabel(selected.startDate)}</dd></div>
          <div><dt>Next run</dt><dd>{dateLabel(selected.nextRunDate)}</dd></div>
          <div><dt>Generated</dt><dd>{selected.occurrencesGenerated}{selected.maxOccurrences ? ` / ${selected.maxOccurrences}` : ""}</dd></div>
          <div><dt>Terms</dt><dd>{selected.paymentTermsDays} days</dd></div>
        </dl>

        <ul class="line-list">
          {#each selected.lines as line (line.id)}
            <li>
              <span>{line.description}</span>
              <strong>{line.quantity} x {money(line.unitPriceCents, selected.currency)}</strong>
            </li>
          {/each}
        </ul>
      {:else}
        <EmptyState title="No schedule selected" description="Open a schedule or generate due drafts to inspect the payload." />
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="schedule-grid mt-6">
      <Card title="Create schedule">
        <form class="schedule-form" method="POST" action="?/createTemplate" use:enhance>
          <div class="form-grid">
            <Field label="Name" id="schedule-name" required>
              <input id="schedule-name" name="name" value={form?.values?.name ?? "Monthly services"} required />
            </Field>
            <Field label="Type" id="schedule-type" required>
              <select id="schedule-type" name="documentType" required>
                <option value="invoice">Invoice</option>
                <option value="bill">Bill</option>
              </select>
            </Field>
            <Field label="Frequency" id="schedule-frequency" required>
              <select id="schedule-frequency" name="frequency" required>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom days</option>
              </select>
            </Field>
          </div>
          <div class="form-grid">
            <Field label="Customer for invoice" id="schedule-customer">
              <select id="schedule-customer" name="customerId">
                <option value="">Select customer</option>
                {#each data.customers as customer (customer.id)}
                  <option value={customer.id}>{customer.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Vendor for bill" id="schedule-vendor">
              <select id="schedule-vendor" name="vendorId">
                <option value="">Select vendor</option>
                {#each data.vendors as vendor (vendor.id)}
                  <option value={vendor.id}>{vendor.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Currency" id="schedule-currency">
              <input id="schedule-currency" name="currency" value="USD" maxlength="3" />
            </Field>
          </div>
          <div class="form-grid">
            <Field label="Start date" id="schedule-start" required>
              <input id="schedule-start" name="startDate" type="date" value={data.today} required />
            </Field>
            <Field label="End date" id="schedule-end">
              <input id="schedule-end" name="endDate" type="date" />
            </Field>
            <Field label="Custom days" id="schedule-custom-days">
              <input id="schedule-custom-days" name="customDays" type="number" min="1" step="1" />
            </Field>
          </div>
          <div class="form-grid form-grid--line">
            <Field label="Line description" id="schedule-description" required>
              <input id="schedule-description" name="description" value={form?.values?.description ?? "Recurring services"} required />
            </Field>
            <Field label="Qty" id="schedule-quantity" required>
              <input id="schedule-quantity" name="quantity" type="number" min="0.01" step="0.01" value={form?.values?.quantity ?? "1"} required />
            </Field>
            <Field label="Unit price" id="schedule-unit-price" required>
              <input id="schedule-unit-price" name="unitPrice" type="number" min="0" step="0.01" value={form?.values?.unitPrice ?? "1200.00"} required />
            </Field>
            <Field label="Tax %" id="schedule-tax-rate">
              <input id="schedule-tax-rate" name="taxRate" type="number" min="0" max="100" step="0.01" value={form?.values?.taxRate ?? "0"} />
            </Field>
            <Field label="Discount" id="schedule-discount">
              <input id="schedule-discount" name="discount" type="number" min="0" step="0.01" value={form?.values?.discount ?? "0"} />
            </Field>
          </div>
          <div class="form-grid">
            <Field label="Payment terms days" id="schedule-terms-days">
              <input id="schedule-terms-days" name="paymentTermsDays" type="number" min="1" step="1" value="30" />
            </Field>
            <Field label="Max occurrences" id="schedule-max-occurrences">
              <input id="schedule-max-occurrences" name="maxOccurrences" type="number" min="1" step="1" />
            </Field>
            <div class="check-grid" aria-label="Automation options">
              <label><input type="checkbox" name="autoSend" /> Auto send invoices</label>
              <label><input type="checkbox" name="autoApprove" /> Auto approve bills</label>
            </div>
          </div>
          <div class="form-grid">
            <Field label="Notes" id="schedule-notes">
              <textarea id="schedule-notes" name="notes" rows="3"></textarea>
            </Field>
            <Field label="Terms" id="schedule-terms">
              <textarea id="schedule-terms" name="terms" rows="3">Generated as a draft for operator review.</textarea>
            </Field>
          </div>
          <div class="form-actions">
            <Button type="submit" variant="primary">Create schedule</Button>
          </div>
        </form>
      </Card>

      <Card title="Generate due drafts">
        <form class="generate-form" method="POST" action="?/generateDue" use:enhance>
          <Field label="As of" id="generate-as-of">
            <input id="generate-as-of" name="asOf" type="date" value={data.today} />
          </Field>
          <Field label="Limit" id="generate-limit">
            <input id="generate-limit" name="limit" type="number" min="1" max="100" step="1" value="25" />
          </Field>
          <Button type="submit" variant="primary">Generate due drafts</Button>
          <p>Generated drafts are returned for review only. This page does not persist invoices or bills yet.</p>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .schedule-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-block-start: 16px;
  }
  .schedule-toolbar a {
    display: inline-flex;
    align-items: center;
    min-block-size: 32px;
    padding-inline: 11px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-ink-soft);
    font-size: 0.83rem;
    font-weight: 600;
    text-decoration: none;
  }
  .schedule-toolbar a.active {
    border-color: var(--color-act);
    background: var(--color-green-soft);
    color: var(--color-green-dark);
  }
  .schedule-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
    gap: 16px;
  }
  .row-actions,
  .selected-head,
  .draft-card {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .draft-stack,
  .schedule-summary {
    display: grid;
    gap: 10px;
  }
  .draft-card {
    padding-block-end: 10px;
    border-block-end: 1px solid var(--color-line);
  }
  .draft-card p,
  .selected-head p,
  .generate-form p {
    margin: 4px 0 0;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .schedule-summary {
    margin: 16px 0 0;
  }
  .schedule-summary div,
  .line-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-block-end: 1px solid var(--color-line);
    padding-block-end: 10px;
  }
  .schedule-summary dt {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .schedule-summary dd {
    margin: 0;
    text-align: end;
  }
  .line-list {
    display: grid;
    gap: 10px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
  }
  .line-list span {
    min-inline-size: 0;
    color: var(--color-ink-soft);
  }
  .line-list strong {
    white-space: nowrap;
  }
  .schedule-form,
  .generate-form {
    display: grid;
    gap: 14px;
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .form-grid--line {
    grid-template-columns: minmax(220px, 2fr) repeat(4, minmax(100px, 1fr));
  }
  .check-grid {
    display: grid;
    align-content: center;
    gap: 8px;
    min-block-size: 100%;
  }
  .check-grid label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-ink-soft);
    font-size: 0.86rem;
  }
  .check-grid input {
    inline-size: auto;
    min-block-size: auto;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
  }
  @media (max-width: 920px) {
    .schedule-grid,
    .form-grid,
    .form-grid--line {
      grid-template-columns: 1fr;
    }
  }
</style>
