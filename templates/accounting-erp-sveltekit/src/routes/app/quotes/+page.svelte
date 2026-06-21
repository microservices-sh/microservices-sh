<script lang="ts">
  import { enhance } from "$app/forms";
  import { money } from "$lib/format";
  import { Alert, Badge, Button, Card, EmptyState, Field, MetricStrip, PageHeader, ResourceTable } from "$lib/ui";
  import type { Metric, Tone } from "$lib/ui/types";

  let { data, form } = $props();

  const selected = $derived(data.selectedQuote);
  const invoiceDraft = $derived(data.invoiceDraft);
  const conversionRate = $derived(`${(data.stats.conversionRateBasisPoints / 100).toFixed(1)}%`);
  const metrics = $derived<Metric[]>([
    { label: "Draft quotes", value: data.stats.draft, tone: data.stats.draft > 0 ? "neutral" : "good", hint: money(data.stats.totalValueCents) },
    { label: "Pending", value: money(data.stats.pendingValueCents), tone: data.stats.pendingValueCents > 0 ? "warn" : "neutral", hint: `${data.stats.sent} sent/viewed` },
    { label: "Accepted", value: money(data.stats.acceptedValueCents), tone: data.stats.acceptedValueCents > 0 ? "good" : "neutral", hint: `${data.stats.accepted} quotes` },
    { label: "Conversion", value: conversionRate, tone: data.stats.converted > 0 ? "good" : "info", hint: `${data.stats.converted} converted` }
  ]);

  const filters = [
    { id: "all", label: "All", href: "/app/quotes" },
    { id: "draft", label: "Draft", href: "/app/quotes?status=draft" },
    { id: "sent", label: "Sent", href: "/app/quotes?status=sent" },
    { id: "accepted", label: "Accepted", href: "/app/quotes?status=accepted" }
  ];

  function tone(status: string): Tone {
    switch (status) {
      case "accepted":
      case "converted":
        return "good";
      case "sent":
      case "viewed":
        return "warn";
      case "declined":
      case "expired":
      case "void":
        return "bad";
      default:
        return "neutral";
    }
  }

  function dateLabel(value: string | null): string {
    if (!value) return "No expiry";
    return new Date(value).toLocaleDateString();
  }
</script>

<svelte:head>
  <title>Quotes - Accounting ERP</title>
</svelte:head>

<main class="section quotes-page">
  <PageHeader
    eyebrow="Estimate quotes"
    title="Quotes"
    description="Draft customer estimates, send them for approval, and inspect invoice draft payloads before issuing invoices."
  >
    {#snippet actions()}
      <Button href="/app/invoices" variant="ghost">Invoices</Button>
    {/snippet}
  </PageHeader>

  {#if form?.quoteCreated}
    <Alert tone="success">Quote {form.quoteNumber} drafted.</Alert>
  {:else if form?.quoteSent}
    <Alert tone="success">Quote sent.</Alert>
  {:else if form?.quoteAccepted}
    <Alert tone="success">Quote accepted.</Alert>
  {:else if form?.quoteDeclined}
    <Alert tone="warn">Quote declined.</Alert>
  {:else if form?.quoteVoided}
    <Alert tone="warn">Quote voided.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <MetricStrip {metrics} />

  <div class="quote-toolbar">
    {#each filters as filter (filter.id)}
      <a class:active={data.activeStatus === filter.id} href={filter.href}>{filter.label}</a>
    {/each}
    <Badge tone="neutral">{data.status.status}</Badge>
  </div>

  <div class="quote-grid mt-6">
    <Card title="Quote pipeline">
      {#snippet header()}
        <Badge tone="neutral">{data.quotes.length}</Badge>
      {/snippet}

      {#if data.quotes.length > 0}
        <ResourceTable class="flush" caption="Estimate quotes">
          {#snippet head()}
            <tr>
              <th>Quote</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Expires</th>
              <th class="table-num">Total</th>
              <th></th>
            </tr>
          {/snippet}
          {#each data.quotes as quote (quote.id)}
            <tr>
              <td data-label="Quote">
                <a class="table-primary" href={`/app/quotes?quote=${quote.id}`}>{quote.quoteNumber}</a>
                <div class="table-muted">{quote.lines.length} line{quote.lines.length === 1 ? "" : "s"}</div>
              </td>
              <td data-label="Customer">
                <a href={`/app/customers/${quote.clientId}`}>{quote.clientName}</a>
              </td>
              <td data-label="Status"><Badge tone={tone(quote.status)}>{quote.status}</Badge></td>
              <td data-label="Expires">{dateLabel(quote.expiryDate)}</td>
              <td data-label="Total" class="table-num">{money(quote.totalCents, quote.currency)}</td>
              <td class="table-action">
                <Button href={`/app/quotes?quote=${quote.id}`} size="sm" variant="ghost">Open</Button>
              </td>
            </tr>
          {/each}
        </ResourceTable>
      {:else}
        <EmptyState title="No quotes yet" description="Drafted estimates will appear here." />
      {/if}
    </Card>

    <Card title={selected ? "Invoice draft preview" : "Quote preview"}>
      {#if selected && invoiceDraft}
        <div class="selected-head">
          <div>
            <strong>{selected.quoteNumber}</strong>
            <p>{selected.clientName} - {money(selected.totalCents, selected.currency)}</p>
          </div>
          <Badge tone={tone(selected.status)}>{selected.status}</Badge>
        </div>

        <dl class="draft-summary">
          <div><dt>Source</dt><dd>{invoiceDraft.sourceQuoteNumber}</dd></div>
          <div><dt>Issue date</dt><dd>{new Date(invoiceDraft.issueDate).toLocaleDateString()}</dd></div>
          <div><dt>Subtotal</dt><dd>{money(invoiceDraft.subtotalCents, invoiceDraft.currency)}</dd></div>
          <div><dt>Tax</dt><dd>{money(invoiceDraft.taxCents, invoiceDraft.currency)}</dd></div>
          <div><dt>Due</dt><dd>{money(invoiceDraft.amountDueCents, invoiceDraft.currency)}</dd></div>
        </dl>

        <ul class="line-list">
          {#each invoiceDraft.lines as line, index (`${line.description}-${index}`)}
            <li>
              <span>{line.description}</span>
              <strong>{line.quantity} x {money(line.unitPriceCents, invoiceDraft.currency)}</strong>
            </li>
          {/each}
        </ul>

        {#if data.canManage}
          <div class="action-row">
            {#if selected.status === "draft"}
              <form method="POST" action="?/sendQuote" use:enhance>
                <input type="hidden" name="quoteId" value={selected.id} />
                <Button type="submit" variant="primary" size="sm">Send</Button>
              </form>
            {/if}
            {#if selected.status === "sent" || selected.status === "viewed"}
              <form method="POST" action="?/acceptQuote" use:enhance>
                <input type="hidden" name="quoteId" value={selected.id} />
                <Button type="submit" variant="success" size="sm">Accept</Button>
              </form>
              <form method="POST" action="?/declineQuote" use:enhance>
                <input type="hidden" name="quoteId" value={selected.id} />
                <input type="hidden" name="reason" value="Declined from quote console" />
                <Button type="submit" variant="ghost" size="sm">Decline</Button>
              </form>
            {/if}
            {#if selected.status !== "converted" && selected.status !== "void"}
              <form method="POST" action="?/voidQuote" use:enhance>
                <input type="hidden" name="quoteId" value={selected.id} />
                <input type="hidden" name="reason" value="Voided from quote console" />
                <Button type="submit" variant="ghost" size="sm">Void</Button>
              </form>
            {/if}
          </div>
        {/if}
      {:else}
        <EmptyState title="No quote selected" description="Open a quote to inspect its invoice draft payload." />
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <Card title="Draft quote" class="mt-6">
      {#if data.customers.length === 0}
        <Alert tone="warn">Add a customer before drafting quotes.</Alert>
        <Button href="/app/customers" variant="primary">Customers</Button>
      {:else}
        <form class="quote-form" method="POST" action="?/createQuote" use:enhance>
          <div class="form-grid">
            <Field label="Customer" id="quote-customer" required>
              <select id="quote-customer" name="customerId" required>
                {#each data.customers as customer (customer.id)}
                  <option value={customer.id}>{customer.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Expiry" id="quote-expiry">
              <input id="quote-expiry" name="expiryDate" type="date" value={data.defaultExpiryDate} />
            </Field>
            <Field label="Currency" id="quote-currency">
              <input id="quote-currency" name="currency" value="USD" maxlength="3" />
            </Field>
          </div>
          <div class="form-grid form-grid--line">
            <Field label="Line description" id="quote-description" required>
              <input id="quote-description" name="description" value={form?.values?.description ?? "Implementation services"} required />
            </Field>
            <Field label="Qty" id="quote-quantity" required>
              <input id="quote-quantity" name="quantity" type="number" min="0.01" step="0.01" value={form?.values?.quantity ?? "1"} required />
            </Field>
            <Field label="Unit price" id="quote-unit-price" required>
              <input id="quote-unit-price" name="unitPrice" type="number" min="0" step="0.01" value={form?.values?.unitPrice ?? "1200.00"} required />
            </Field>
            <Field label="Tax %" id="quote-tax-rate">
              <input id="quote-tax-rate" name="taxRate" type="number" min="0" max="100" step="0.01" value={form?.values?.taxRate ?? "0"} />
            </Field>
            <Field label="Discount" id="quote-discount">
              <input id="quote-discount" name="discount" type="number" min="0" step="0.01" value={form?.values?.discount ?? "0"} />
            </Field>
          </div>
          <div class="form-grid">
            <Field label="Notes" id="quote-notes">
              <textarea id="quote-notes" name="notes" rows="3">{form?.values?.notes ?? ""}</textarea>
            </Field>
            <Field label="Terms" id="quote-terms">
              <textarea id="quote-terms" name="terms" rows="3">{form?.values?.terms ?? "Valid for 30 days."}</textarea>
            </Field>
          </div>
          <div class="form-actions">
            <Button type="submit" variant="primary">Draft quote</Button>
          </div>
        </form>
      {/if}
    </Card>
  {/if}
</main>

<style>
  .quote-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-block-start: 16px;
  }
  .quote-toolbar a {
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
  .quote-toolbar a.active {
    border-color: var(--color-act);
    background: var(--color-green-soft);
    color: var(--color-green-dark);
  }
  .quote-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
    gap: 16px;
  }
  .selected-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-block-end: 16px;
  }
  .selected-head p {
    margin: 4px 0 0;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .draft-summary {
    display: grid;
    gap: 10px;
    margin: 0;
  }
  .draft-summary div,
  .line-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-block-end: 1px solid var(--color-line);
    padding-block-end: 10px;
  }
  .draft-summary dt {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .draft-summary dd {
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
  .action-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-block-start: 18px;
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .form-grid--line {
    grid-template-columns: minmax(220px, 2fr) repeat(4, minmax(100px, 1fr));
  }
  .quote-form :global(.field) {
    margin-block-end: 0;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-block-start: 14px;
  }
  @media (max-width: 980px) {
    .quote-grid,
    .form-grid,
    .form-grid--line {
      grid-template-columns: 1fr;
    }
  }
</style>
