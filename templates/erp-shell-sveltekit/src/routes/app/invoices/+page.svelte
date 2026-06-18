<script lang="ts">
  import { enhance } from "$app/forms";
  import { Card, Eyebrow, Badge, Button, Field, Alert } from "$lib/ui";

  let { data, form } = $props();

  const money = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  // Invoice status → Badge tone. paid = good, open = warn, void = bad, draft = neutral.
  function tone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "paid":
        return "good";
      case "open":
        return "warn";
      case "void":
        return "bad";
      default:
        return "neutral";
    }
  }

  // ── New-invoice editor state ───────────────────────────────────────────────
  type Line = { description: string; qty: number; unit: string; taxPct: number };
  const blankLine = (): Line => ({ description: "", qty: 1, unit: "", taxPct: 0 });

  let customerId = $state("");
  let currency = $state("USD");
  let termsDays = $state(14);
  let lines = $state<Line[]>([blankLine()]);
  let submitting = $state(false);

  function addLine() {
    lines = [...lines, blankLine()];
  }
  function removeLine(i: number) {
    lines = lines.length > 1 ? lines.filter((_, n) => n !== i) : lines;
  }

  // A line counts once it has a description and a parseable positive unit price.
  const dollars = (v: string) => {
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
  <title>Invoices · ERP Shell</title>
</svelte:head>

<main class="section">
  <Eyebrow>Billing ledger</Eyebrow>
  <h1>Invoices</h1>
  <p>Issue and track invoices for your company, powered by the invoice module.</p>

  {#if form?.ok}
    <Alert tone="success">Invoice {form.number} issued.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card>
      <h2>Ledger</h2>
      {#if data.invoices.length > 0}
        <ul class="list" role="list">
          {#each data.invoices as invoice}
            <li class="list-item row-item">
              <span><strong>{invoice.number}</strong> · {invoice.customer}</span>
              <span class="nav" style="align-items: center;">
                <Badge tone={tone(invoice.status)}>{invoice.status}</Badge>
                <span>{money(invoice.totalCents, invoice.currency)}</span>
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No invoices yet. Issue your first one →</p>
      {/if}
    </Card>

    {#if data.canManage}
      <Card>
        <h2>New invoice</h2>
        {#if data.customers.length === 0}
          <p class="empty">
            Add a customer first, then come back to issue an invoice.
            <a class="empty-cta" href="/app/customers">Go to Customers →</a>
          </p>
        {:else}
          <form
            method="POST"
            action="?/create"
            use:enhance={() => {
              submitting = true;
              return async ({ result, update }) => {
                submitting = false;
                // On success, reset the editor and refresh the ledger; on
                // validation failure keep the entered lines and show the error.
                if (result.type === "success") {
                  customerId = "";
                  currency = "USD";
                  termsDays = 14;
                  lines = [blankLine()];
                }
                await update();
              };
            }}
          >
            <Field label="Customer" id="customerId">
              <select id="customerId" name="customerId" bind:value={customerId} required>
                <option value="" disabled>Choose a customer…</option>
                {#each data.customers as customer}
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

            <Button type="submit" variant="primary" disabled={!canSubmit}>
              {submitting ? "Issuing…" : "Issue invoice"}
            </Button>
          </form>
        {/if}
      </Card>
    {/if}
  </div>
</main>

<style>
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .empty-cta {
    display: inline-block;
    margin-block-start: 8px;
    color: var(--color-act);
    font-weight: 500;
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
    margin: 4px 0 16px;
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
