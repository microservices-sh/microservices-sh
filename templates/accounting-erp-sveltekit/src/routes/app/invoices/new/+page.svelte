<script>
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Button, Field, Alert, EmptyState, FormActions } from "$lib/ui";

  let { data, form } = $props();

  const money = (cents, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  const blankLine = () => ({ description: "", qty: 1, unit: "", taxPct: 0 });

  let customerId = $state("");
  let currency = $state("USD");
  let termsDays = $state(14);
  let lines = $state([blankLine()]);
  let submitting = $state(false);

  function addLine() {
    lines = [...lines, blankLine()];
  }
  function removeLine(i) {
    lines = lines.length > 1 ? lines.filter((_, n) => n !== i) : lines;
  }

  const dollars = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  };
  const validLines = $derived(
    lines.filter((l) => l.description.trim().length > 0 && Number.isFinite(dollars(l.unit)) && dollars(l.unit) > 0)
  );
  // Server contract: cents + basis points. Convert here so the server stays thin.
  const payload = $derived(
    validLines.map((l) => ({
      description: l.description.trim(),
      quantity: Math.max(1, Math.trunc(l.qty) || 1),
      unitAmountCents: Math.round(dollars(l.unit) * 100),
      taxRateBps: Math.round((Number.isFinite(l.taxPct) ? l.taxPct : 0) * 100)
    }))
  );
  const subtotalCents = $derived(payload.reduce((sum, l) => sum + l.unitAmountCents * l.quantity, 0));
  const taxCents = $derived(
    payload.reduce((sum, l) => sum + Math.round(l.unitAmountCents * l.quantity * (l.taxRateBps / 10_000)), 0)
  );
  const totalCents = $derived(subtotalCents + taxCents);
  const canSubmit = $derived(Boolean(customerId) && payload.length > 0 && !submitting);
</script>

<svelte:head>
  <title>New invoice · ERP Shell</title>
</svelte:head>

<main class="section narrow">
  <PageHeader eyebrow="Billing ledger" title="New invoice" description="Issue an invoice to a customer.">
    {#snippet actions()}
      <Button href="/app/invoices" variant="ghost">← Ledger</Button>
    {/snippet}
  </PageHeader>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <Card>
    {#if data.customers.length === 0}
      <EmptyState title="Add a customer first" description="You need a customer before you can issue an invoice.">
        {#snippet action()}
          <Button href="/app/customers" variant="primary">Go to Customers</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <form
        method="POST"
        use:enhance={() => {
          submitting = true;
          return async ({ update }) => {
            submitting = false;
            await update();
          };
        }}
      >
        <Field label="Customer" id="customerId" required>
          <select id="customerId" name="customerId" bind:value={customerId} required>
            <option value="" disabled>Choose a customer…</option>
            {#each data.customers as customer (customer.id)}
              <option value={customer.id}>{customer.name}</option>
            {/each}
          </select>
        </Field>

        <div class="inv-lines">
          <div class="inv-lines-head">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Tax %</span>
            <span></span>
          </div>
          {#each lines as line, i (i)}
            <div class="inv-line">
              <input class="inv-desc" placeholder="Consulting — March" bind:value={line.description} aria-label="Description" />
              <input class="inv-num" type="number" min="1" step="1" bind:value={line.qty} aria-label="Quantity" />
              <input class="inv-num" type="number" min="0" step="0.01" placeholder="0.00" bind:value={line.unit} aria-label="Unit price" />
              <input class="inv-num" type="number" min="0" step="0.1" bind:value={line.taxPct} aria-label="Tax percent" />
              <button type="button" class="inv-remove" onclick={() => removeLine(i)} aria-label="Remove line" disabled={lines.length === 1}>✕</button>
            </div>
          {/each}
          <Button type="button" variant="ghost" size="sm" onclick={addLine}>+ Add line</Button>
        </div>

        <div class="inv-meta">
          <Field label="Currency" id="currency">
            <input id="currency" name="currency" bind:value={currency} maxlength="3" style="text-transform: uppercase;" />
          </Field>
          <Field label="Payment terms (days)" id="termsDays">
            <input id="termsDays" name="termsDays" type="number" min="0" max="365" step="1" bind:value={termsDays} />
          </Field>
        </div>

        <dl class="inv-totals">
          <div><dt>Subtotal</dt><dd>{money(subtotalCents, currency)}</dd></div>
          <div><dt>Tax</dt><dd>{money(taxCents, currency)}</dd></div>
          <div class="inv-total-row"><dt>Total</dt><dd>{money(totalCents, currency)}</dd></div>
        </dl>

        <!-- Authoritative payload: cents + basis points, validated server-side. -->
        <input type="hidden" name="lineItems" value={JSON.stringify(payload)} />

        <FormActions
          submitLabel="Issue invoice"
          submittingLabel="Issuing…"
          cancelHref="/app/invoices"
          {submitting}
          disabled={!canSubmit}
        />
      </form>
    {/if}
  </Card>
</main>

<style>
  .narrow :global(.ph),
  .narrow :global(.card) {
    max-inline-size: 680px;
  }
  .inv-lines {
    margin-block: 8px 16px;
  }
  .inv-lines-head,
  .inv-line {
    display: grid;
    grid-template-columns: 1fr 56px 92px 64px 32px;
    gap: 8px;
    align-items: center;
  }
  .inv-lines-head {
    margin-block-end: 6px;
    font-size: 0.7rem;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-ink-faint);
  }
  .inv-line {
    margin-block-end: 8px;
  }
  .inv-desc,
  .inv-num {
    min-block-size: 36px;
    padding: 7px 10px;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    color: var(--color-ink);
    font: inherit;
    font-size: 0.88rem;
  }
  .inv-num {
    text-align: end;
  }
  .inv-desc:focus,
  .inv-num:focus {
    outline: none;
    border-color: var(--color-act);
    box-shadow: var(--focus-ring);
  }
  .inv-remove {
    display: grid;
    place-items: center;
    inline-size: 32px;
    min-block-size: 36px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-ink-faint);
    cursor: pointer;
  }
  .inv-remove:hover:not(:disabled) {
    border-color: var(--color-red);
    color: var(--color-red);
  }
  .inv-remove:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .inv-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .inv-totals {
    margin: 4px 0 0;
    padding-block-start: 12px;
    border-block-start: 1px solid var(--color-line);
  }
  .inv-totals > div {
    display: flex;
    justify-content: space-between;
    padding-block: 3px;
    font-size: 0.88rem;
    color: var(--color-ink-soft);
  }
  .inv-totals dt,
  .inv-totals dd {
    margin: 0;
  }
  .inv-total-row {
    margin-block-start: 4px;
    padding-block-start: 8px;
    border-block-start: 1px solid var(--color-line);
    font-weight: 600;
    font-size: 0.98rem !important;
    color: var(--color-ink) !important;
  }
</style>
