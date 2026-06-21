<script>
  import { Badge, Button, Card, PageHeader } from "$lib/ui";

  let { data } = $props();
  const statementImport = $derived(data.statementImport);
  const hasTransactions = $derived(data.transactions.length > 0);
</script>

<svelte:head>
  <title>{statementImport.title} · Banking · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Statement import" title={statementImport.title}>
    {#snippet actions()}
      <Button href="/app/banking" variant="ghost">&larr; Banking</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={statementImport.tone}>{statementImport.status}</Badge>
      <span>·</span>
      <span>{statementImport.sourceLabel}</span>
      {#if data.account}
        <span>·</span>
        <span>{data.account.name}</span>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="grid">
    <div class="grid__main">
      <Card title="Imported transactions">
        {#if hasTransactions}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Hash</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {#each data.transactions as tx (tx.id)}
                  <tr>
                    <td>{tx.transactionDate}</td>
                    <td>
                      <strong>{tx.description}</strong>
                      <span>{tx.created}</span>
                    </td>
                    <td><code>{tx.transactionHash}</code></td>
                    <td>
                      <div class="status-cell">
                        <Badge tone={tx.matchTone}>{tx.matchStatus}</Badge>
                        {#if tx.reconciled}
                          <small>Reconciled {tx.reconciledAtShort}</small>
                        {:else}
                          <small>Not reconciled</small>
                        {/if}
                      </div>
                    </td>
                    <td><Badge tone={tx.amountTone}>{tx.amount}</Badge></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No transactions were attached to this import.</p>
        {/if}
      </Card>

      <Card title="Reconciliation context">
        {#if data.reconciliations.length > 0}
          <div class="session-list">
            {#each data.reconciliations as session (session.id)}
              <div>
                <span>{session.statementDate}</span>
                <strong>{session.statementBalance}</strong>
                <Badge tone={session.tone}>{session.status}</Badge>
                <small>{session.difference}</small>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty">No reconciliation sessions recorded for this bank account.</p>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Import summary">
        <dl class="detail-list">
          <div><dt>Status</dt><dd><Badge tone={statementImport.tone}>{statementImport.status}</Badge></dd></div>
          <div><dt>Imported</dt><dd>{statementImport.importedAtShort}</dd></div>
          <div><dt>Created</dt><dd>{statementImport.created}</dd></div>
          <div><dt>Range</dt><dd>{statementImport.startDateShort} to {statementImport.endDateShort}</dd></div>
          <div><dt>Total rows</dt><dd>{data.summary.totalRows}</dd></div>
          <div><dt>Imported rows</dt><dd>{data.summary.importedRows}</dd></div>
          <div><dt>Duplicates</dt><dd>{data.summary.duplicateRows}</dd></div>
          <div><dt>Skipped</dt><dd>{data.summary.skippedRows}</dd></div>
        </dl>
      </Card>

      <Card title="Totals">
        <dl class="detail-list">
          <div><dt>Deposits</dt><dd class="num">{data.summary.deposits}</dd></div>
          <div><dt>Withdrawals</dt><dd class="num">{data.summary.withdrawals}</dd></div>
          <div><dt>Net</dt><dd class="num strong">{data.summary.net}</dd></div>
          <div><dt>Unmatched</dt><dd>{data.summary.unmatchedCount}</dd></div>
          <div><dt>Reconciled</dt><dd>{data.summary.reconciledCount}</dd></div>
        </dl>
      </Card>

      <Card title="Bank account">
        {#if data.account}
          <dl class="detail-list">
            <div><dt>Account</dt><dd>{data.account.name}</dd></div>
            <div><dt>Bank</dt><dd>{data.account.bankName}</dd></div>
            <div><dt>Currency</dt><dd>{data.account.currency}</dd></div>
            <div><dt>Opening</dt><dd>{data.account.openingBalance}</dd></div>
          </dl>
        {:else}
          <p class="empty">The linked bank account is no longer available.</p>
        {/if}
      </Card>

      <Card title="CSV mapping">
        {#if statementImport.mapping.length > 0}
          <ul class="mapping-list">
            {#each statementImport.mapping as item}
              <li>{item}</li>
            {/each}
          </ul>
        {:else}
          <p class="empty">No field mapping was stored for this import.</p>
        {/if}
      </Card>

      <Card title="Operator workflow">
        <p class="status-note">Use the Banking ledger for matching and reconciliation actions so import detail review stays read-only.</p>
        <Button href="/app/banking" variant="ghost">Open banking actions</Button>
      </Card>
    </div>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
    grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.8fr);
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
    min-width: 760px;
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
  td span,
  small {
    display: block;
    color: var(--color-ink-faint);
    font-size: 0.78rem;
  }
  code {
    font-size: 0.76rem;
    overflow-wrap: anywhere;
  }
  .status-cell {
    display: grid;
    gap: 6px;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .strong {
    color: var(--color-ink);
    font-weight: 600;
  }
  .mapping-list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding-inline-start: 18px;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .session-list {
    display: grid;
    gap: 10px;
  }
  .session-list div {
    display: grid;
    grid-template-columns: minmax(92px, 1fr) minmax(100px, 1fr) auto minmax(84px, 0.7fr);
    align-items: center;
    gap: 10px;
  }
  .status-note,
  .empty {
    margin: 0;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .status-note + :global(a),
  .status-note + :global(button) {
    margin-block-start: 14px;
  }
  @media (max-width: 940px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
