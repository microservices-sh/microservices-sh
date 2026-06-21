<script>
  import { enhance } from "$app/forms";
  import { Alert, Button, Card, EmptyState, Field, FormActions, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const today = new Date().toISOString().slice(0, 10);
  const money = (cents, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  const blankLine = () => ({ description: "", qty: 1, unit: "", taxPct: 0 });

  let name = $state("");
  let customerId = $state("");
  let currency = $state("USD");
  let frequency = $state("monthly");
  let customDays = $state(30);
  let startAt = $state(today);
  let endAt = $state("");
  let paymentTermsDays = $state(14);
  let maxOccurrences = $state("");
  let autoIssue = $state(true);
  let notes = $state("");
  let lines = $state([blankLine()]);
  let submitting = $state(false);

  function addLine() {
    lines = [...lines, blankLine()];
  }
  function removeLine(i) {
    lines = lines.length > 1 ? lines.filter((_, n) => n !== i) : lines;
  }

  const dollars = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const validLines = $derived(
    lines.filter((line) => line.description.trim().length > 0 && Number.isFinite(dollars(line.unit)) && dollars(line.unit) > 0)
  );
  const payload = $derived(
    validLines.map((line) => ({
      description: line.description.trim(),
      quantity: Math.max(1, Math.trunc(line.qty) || 1),
      unitAmountCents: Math.round(dollars(line.unit) * 100),
      taxRateBps: Math.round((Number.isFinite(line.taxPct) ? line.taxPct : 0) * 100)
    }))
  );
  const subtotalCents = $derived(payload.reduce((sum, line) => sum + line.unitAmountCents * line.quantity, 0));
  const taxCents = $derived(
    payload.reduce((sum, line) => sum + Math.round(line.unitAmountCents * line.quantity * (line.taxRateBps / 10_000)), 0)
  );
  const totalCents = $derived(subtotalCents + taxCents);
  const canSubmit = $derived(
    name.trim().length > 0 &&
      Boolean(customerId) &&
      startAt.trim().length > 0 &&
      payload.length > 0 &&
      (frequency !== "custom" || customDays > 0) &&
      !submitting
  );
</script>

<svelte:head>
  <title>New recurring invoice · Commerce Ops</title>
</svelte:head>

<main class="section narrow">
  <PageHeader eyebrow="Billing automation" title="New recurring invoice" description="Create a reusable invoice schedule.">
    {#snippet actions()}
      <Button href="/app/invoices/recurring" variant="ghost">Recurring invoices</Button>
    {/snippet}
  </PageHeader>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <Card>
    {#if data.customers.length === 0}
      <EmptyState title="Add a customer first" description="You need a customer before you can create a recurring invoice.">
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
        <Field label="Template name" id="name" required>
          <input id="name" name="name" bind:value={name} required placeholder="Monthly managed services" />
        </Field>

        <Field label="Customer" id="customerId" required>
          <select id="customerId" name="customerId" bind:value={customerId} required>
            <option value="" disabled>Choose a customer...</option>
            {#each data.customers as customer (customer.id)}
              <option value={customer.id}>{customer.name}</option>
            {/each}
          </select>
        </Field>

        <div class="form-grid">
          <Field label="Frequency" id="frequency">
            <select id="frequency" name="frequency" bind:value={frequency}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom days</option>
            </select>
          </Field>
          {#if frequency === "custom"}
            <Field label="Every days" id="customDays">
              <input id="customDays" name="customDays" type="number" min="1" step="1" bind:value={customDays} />
            </Field>
          {/if}
        </div>

        <div class="form-grid">
          <Field label="Start date" id="startAt" required>
            <input id="startAt" name="startAt" type="date" bind:value={startAt} required />
          </Field>
          <Field label="End date" id="endAt">
            <input id="endAt" name="endAt" type="date" bind:value={endAt} />
          </Field>
        </div>

        <div class="form-grid">
          <Field label="Currency" id="currency">
            <input id="currency" name="currency" maxlength="3" bind:value={currency} style="text-transform: uppercase;" />
          </Field>
          <Field label="Payment terms (days)" id="paymentTermsDays">
            <input id="paymentTermsDays" name="paymentTermsDays" type="number" min="0" max="365" step="1" bind:value={paymentTermsDays} />
          </Field>
        </div>

        <div class="form-grid">
          <Field label="Max occurrences" id="maxOccurrences">
            <input id="maxOccurrences" name="maxOccurrences" type="number" min="1" step="1" bind:value={maxOccurrences} placeholder="Unlimited" />
          </Field>
          <label class="check-row">
            <input name="autoIssue" type="checkbox" bind:checked={autoIssue} />
            <span>Issue generated invoices automatically</span>
          </label>
        </div>

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
              <input class="inv-desc" placeholder="Managed services" bind:value={line.description} aria-label="Description" />
              <input class="inv-num" type="number" min="1" step="1" bind:value={line.qty} aria-label="Quantity" />
              <input class="inv-num" type="number" min="0" step="0.01" placeholder="0.00" bind:value={line.unit} aria-label="Unit price" />
              <input class="inv-num" type="number" min="0" step="0.1" bind:value={line.taxPct} aria-label="Tax percent" />
              <button type="button" class="inv-remove" onclick={() => removeLine(i)} aria-label="Remove line" disabled={lines.length === 1}>x</button>
            </div>
          {/each}
          <Button type="button" variant="ghost" size="sm" onclick={addLine}>+ Add line</Button>
        </div>

        <Field label="Notes" id="notes">
          <textarea id="notes" name="notes" rows="3" bind:value={notes} placeholder="Optional invoice notes"></textarea>
        </Field>

        <dl class="inv-totals">
          <div><dt>Subtotal</dt><dd>{money(subtotalCents, currency)}</dd></div>
          <div><dt>Tax</dt><dd>{money(taxCents, currency)}</dd></div>
          <div class="inv-total-row"><dt>Total</dt><dd>{money(totalCents, currency)}</dd></div>
        </dl>

        <input type="hidden" name="lineItems" value={JSON.stringify(payload)} />

        <FormActions
          submitLabel="Create recurring invoice"
          submittingLabel="Creating..."
          cancelHref="/app/invoices/recurring"
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
    max-inline-size: 760px;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .check-row {
    align-self: end;
    min-block-size: 38px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-ink-soft);
    font-size: 0.9rem;
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
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
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
  .inv-totals {
    margin: 4px 0 0;
    padding-block-start: 12px;
    border-block-start: 1px solid var(--color-line);
  }
  .inv-totals > div {
    display: flex;
    justify-content: space-between;
    padding-block: 3px;
    color: var(--color-ink-soft);
    font-size: 0.88rem;
  }
  .inv-totals dt,
  .inv-totals dd {
    margin: 0;
  }
  .inv-total-row {
    margin-block-start: 4px;
    padding-block-start: 8px;
    border-block-start: 1px solid var(--color-line);
    color: var(--color-ink) !important;
    font-size: 0.98rem !important;
    font-weight: 600;
  }
  @media (max-width: 720px) {
    .form-grid,
    .inv-lines-head,
    .inv-line {
      grid-template-columns: 1fr;
    }
    .inv-lines-head {
      display: none;
    }
    .inv-num {
      text-align: start;
    }
  }
</style>
