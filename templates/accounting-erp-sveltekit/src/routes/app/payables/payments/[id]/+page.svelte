<script>
  import { Badge, Button, Card, PageHeader } from "$lib/ui";

  let { data } = $props();
  const payment = $derived(data.payment);
</script>

<svelte:head>
  <title>{payment.paymentNumber} · AP Payment · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="AP payment" title={payment.paymentNumber}>
    {#snippet actions()}
      <Button href="/app/payables" variant="ghost">Payables</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={payment.statusTone}>{payment.status}</Badge>
      <span>{payment.vendorName}</span>
      <span>{payment.amount}</span>
    {/snippet}
  </PageHeader>

  <div class="grid">
    <div class="grid__main">
      <Card title="Payment details">
        <dl class="detail-list">
          <div><dt>Vendor</dt><dd><a href={`/app/payables/vendors/${payment.vendorId}`}>{payment.vendorName}</a></dd></div>
          <div><dt>Payment date</dt><dd>{payment.paymentDateShort}</dd></div>
          <div><dt>Amount</dt><dd>{payment.amount}</dd></div>
          <div><dt>Unapplied</dt><dd>{payment.unapplied}</dd></div>
          <div><dt>Payment account</dt><dd>{payment.paymentAccountLabel}</dd></div>
          <div><dt>Method</dt><dd>{payment.method}</dd></div>
          <div><dt>Reference</dt><dd>{payment.referenceNumber}</dd></div>
          <div><dt>Journal entry</dt><dd>{payment.journalEntryId}</dd></div>
          <div><dt>Created</dt><dd>{payment.created}</dd></div>
          <div><dt>Updated</dt><dd>{payment.updated}</dd></div>
        </dl>
      </Card>

      <Card title="Applications">
        {#if payment.applications.length > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Applied</th>
                  <th>Date</th>
                  <th>Bill status</th>
                  <th>Bill due</th>
                </tr>
              </thead>
              <tbody>
                {#each payment.applications as application (application.id)}
                  <tr>
                    <td><a href={`/app/payables/${application.billId}`}><code>{application.billNumber}</code></a></td>
                    <td>{application.amount}</td>
                    <td>{application.appliedAtShort}</td>
                    <td>{application.billStatus}</td>
                    <td>{application.billDue}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No bill applications are attached to this payment.</p>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Lifecycle">
        <dl class="detail-list compact">
          <div><dt>Status</dt><dd><Badge tone={payment.statusTone}>{payment.status}</Badge></dd></div>
          <div><dt>Posted</dt><dd>{payment.postedAtShort}</dd></div>
          <div><dt>Voided</dt><dd>{payment.voidedAtShort}</dd></div>
          <div><dt>Void reason</dt><dd>{payment.voidReason ?? "-"}</dd></div>
        </dl>
        <p class="status-note">Void and reversal actions are intentionally absent until AP payment reversal has a journal-safe design.</p>
      </Card>

      {#if payment.memo}
        <Card title="Memo">
          <p class="status-note">{payment.memo}</p>
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
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.85fr);
    align-items: start;
  }
  .grid__main,
  .grid__side {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 620px;
    border-collapse: collapse;
  }
  th,
  td {
    border-block-end: 1px solid var(--color-line);
    padding: 10px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .compact {
    grid-template-columns: 1fr;
  }
  .status-note,
  .empty {
    margin: 12px 0 0;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
