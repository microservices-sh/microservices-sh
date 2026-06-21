<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Badge, Button, Field, Alert, FormActions, WorkflowTimeline } from "$lib/ui";

  let { data, form } = $props();
  const inv = $derived(data.invoice);
  const paymentLinkHref = $derived(form?.paymentLinkUrl ?? inv.paymentLinkUrl);

  let payAmount = $state("");
  let submitting = $state(false);

  $effect(() => {
    payAmount = String(inv.outstandingAmount);
  });

  function payEnhance() {
    submitting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      submitting = false;
      await update();
    };
  }
</script>

<svelte:head>
  <title>{inv.number} · Invoices · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Invoice" title={inv.number}>
    {#snippet actions()}
      <Button href="/app/invoices" variant="ghost">← Ledger</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={inv.tone}>{inv.status}</Badge>
      {#if inv.overdue}<Badge tone="bad">overdue</Badge>{/if}
      <span>·</span>
      <a href={`/app/customers/${inv.customerId}`}>{inv.customerName}</a>
      {#if inv.due}<span>· due {inv.due}</span>{/if}
    {/snippet}
  </PageHeader>

  {#if form?.paymentRecorded}
    <Alert tone={form.syncWarning ? "warning" : "success"}>
      {form.paid ? "Payment recorded — invoice marked paid." : "Payment recorded."}{#if form.syncWarning} Receivables sync needs retry: {form.syncWarning}{/if}
    </Alert>
  {:else if form?.invoiceVoided}
    <Alert tone={form.syncWarning ? "warning" : "success"}>
      Invoice voided.{#if form.syncWarning} Receivables sync needs retry: {form.syncWarning}{/if}
    </Alert>
  {:else if form?.invoiceSent}
    <Alert tone="success">Invoice sent to {form.recipient}.</Alert>
  {:else if form?.paymentLinkCreated}
    <Alert tone="success">Payment link ready.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="grid">
    <div class="grid__main">
      <Card title="Summary">
        <dl class="detail-list">
          <div>
            <dt>Customer</dt>
            <dd><a href={`/app/customers/${inv.customerId}`}>{inv.customerName}</a></dd>
          </div>
          <div><dt>Status</dt><dd><Badge tone={inv.tone}>{inv.status}</Badge></dd></div>
          <div><dt>Issued</dt><dd>{inv.issued ?? "—"}</dd></div>
          <div>
            <dt>Due</dt>
            <dd>{inv.due ?? "—"}{#if inv.overdue} <Badge tone="bad">overdue</Badge>{/if}</dd>
          </div>
          <div><dt>Subtotal</dt><dd class="num">{inv.subtotal}</dd></div>
          <div><dt>Tax</dt><dd class="num">{inv.tax}</dd></div>
          <div><dt>Total</dt><dd class="num strong">{inv.total}</dd></div>
          <div><dt>Paid</dt><dd class="num">{inv.paid}</dd></div>
          <div><dt>Outstanding</dt><dd class="num strong">{inv.outstanding}</dd></div>
        </dl>
      </Card>

      <Card title="Activity">
        <WorkflowTimeline events={data.timeline} emptyLabel="No activity recorded for this invoice yet." />
      </Card>
    </div>

    <div class="grid__side">
      {#if inv.isOpen && data.canManage}
        <Card title="Payment link">
          {#if paymentLinkHref}
            <p class="status-note">Share this secure link for online payment.</p>
            <Button href={paymentLinkHref} variant="primary" size="sm" target="_blank" rel="noreferrer">Open payment link</Button>
          {:else}
            <p class="status-note">Create a one-time online payment link for the outstanding balance.</p>
            <form method="POST" action="?/paymentLink" use:enhance>
              <FormActions submitLabel="Create payment link" />
            </form>
          {/if}
        </Card>

        <Card title="Send invoice">
          {#if inv.customer.email}
            <p class="status-note">Email the invoice and payment link to {inv.customer.email}.</p>
            <form method="POST" action="?/sendInvoice" use:enhance>
              <FormActions submitLabel={paymentLinkHref ? "Send invoice" : "Create link + send"} />
            </form>
          {:else}
            <p class="status-note">Add an email address to this customer before sending invoices.</p>
          {/if}
        </Card>

        <Card title="Record payment">
          <form method="POST" action="?/payment" use:enhance={payEnhance}>
            <Field label="Amount" id="amount" hint={`Outstanding ${inv.outstanding}`}>
              <input id="amount" name="amount" type="number" min="0.01" step="0.01" bind:value={payAmount} />
            </Field>
            <FormActions submitLabel="Record payment" submittingLabel="Recording…" {submitting} />
          </form>
        </Card>
        {#if inv.isVoidable}
          <Card title="Invoice controls">
            <form method="POST" action="?/void" use:enhance>
              <Button type="submit" variant="ghost">Void invoice</Button>
            </form>
          </Card>
        {/if}
      {:else}
        <Card title="Status">
          <p class="status-note">
            This invoice is <strong>{inv.status}</strong>.{#if inv.paidAt} Settled {inv.paidAt}.{/if}
          </p>
        </Card>
      {/if}
    </div>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
    margin-block-start: 4px;
    grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.85fr);
    align-items: start;
  }
  .grid__main,
  .grid__side {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .strong {
    font-weight: 600;
    color: var(--color-ink);
  }
  .status-note {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-ink-soft);
  }
</style>
