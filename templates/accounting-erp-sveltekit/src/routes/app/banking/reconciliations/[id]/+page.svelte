<script>
  import { Badge, Button, Card, PageHeader } from "$lib/ui";

  let { data } = $props();
  const reconciliation = $derived(data.reconciliation);
  const hasTransactions = $derived(data.transactions.length > 0);
</script>

<svelte:head>
  <title>{reconciliation.title} · Banking · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Bank reconciliation" title={reconciliation.title}>
    {#snippet actions()}
      <Button href="/app/banking" variant="ghost">&larr; Banking</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={reconciliation.tone}>{reconciliation.status}</Badge>
      {#if data.account}
        <span>·</span>
        <span>{data.account.name}</span>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="grid">
    <div class="grid__main">
      <Card title="Statement transactions">
        {#if hasTransactions}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Import</th>
                  <th>Match</th>
                  <th>Clear state</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {#each data.transactions as tx (tx.id)}
                  <tr>
                    <td>{tx.transactionDate}</td>
                    <td>
                      <strong>{tx.description}</strong>
                      {#if tx.ledgerReferenceId}
                        <span>{tx.ledgerReferenceId}</span>
                      {/if}
                    </td>
                    <td>
                      {#if tx.statementImportId && tx.importTitle}
                        <a href={`/app/banking/imports/${tx.statementImportId}`}>{tx.importTitle}</a>
                      {:else}
                        <span>-</span>
                      {/if}
                    </td>
                    <td>
                      <div class="status-cell">
                        <Badge tone={tx.matchTone}>{tx.matchStatus}</Badge>
                        {#if tx.reconciled}
                          <small>Reconciled {tx.reconciledAtShort}</small>
                        {:else}
                          <small>Open for reconciliation</small>
                        {/if}
                      </div>
                    </td>
                    <td>
                      <div class="status-cell">
                        <Badge tone={tx.clearTone}>{tx.clearStatus}</Badge>
                        {#if tx.cleared && !tx.reconciled}
                          <small>Cleared {tx.clearedAtShort}</small>
                        {:else if !tx.reconciled}
                          <small>Pending operator review</small>
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
          <p class="empty">No transactions are in scope for this reconciliation.</p>
        {/if}
      </Card>

      <Card title="Related imports">
        {#if data.imports.length > 0}
          <div class="import-list">
            {#each data.imports as statementImport (statementImport.id)}
              <a href={`/app/banking/imports/${statementImport.id}`}>
                <span>{statementImport.title}</span>
                <strong>{statementImport.importedRows} rows</strong>
                <Badge tone={statementImport.tone}>{statementImport.status}</Badge>
                <small>{statementImport.duplicateRows} duplicates</small>
              </a>
            {/each}
          </div>
        {:else}
          <p class="empty">No statement imports are attached to the transactions in this session.</p>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Reconciliation summary">
        <dl class="detail-list">
          <div><dt>Status</dt><dd><Badge tone={reconciliation.tone}>{reconciliation.status}</Badge></dd></div>
          <div><dt>Statement date</dt><dd>{reconciliation.statementDate}</dd></div>
          <div><dt>Period</dt><dd>{reconciliation.periodStartShort} to {reconciliation.periodEndShort}</dd></div>
          <div><dt>Created</dt><dd>{reconciliation.created}</dd></div>
          <div><dt>Changed</dt><dd>{reconciliation.changed}</dd></div>
          <div><dt>Completed</dt><dd>{reconciliation.completedAtShort}</dd></div>
        </dl>
      </Card>

      <Card title="Balance proof">
        <dl class="detail-list">
          <div><dt>Opening</dt><dd class="num">{reconciliation.openingBalance}</dd></div>
          <div><dt>Deposits</dt><dd class="num">{reconciliation.clearedDeposits}</dd></div>
          <div><dt>Withdrawals</dt><dd class="num">{reconciliation.clearedWithdrawals}</dd></div>
          <div><dt>Cleared</dt><dd class="num">{reconciliation.clearedBalance}</dd></div>
          <div><dt>Statement</dt><dd class="num">{reconciliation.statementBalance}</dd></div>
          <div><dt>Difference</dt><dd class="num strong">{reconciliation.difference}</dd></div>
        </dl>
      </Card>

      <Card title="Transaction counts">
        <dl class="detail-list">
          <div><dt>Transactions</dt><dd>{data.summary.transactionCount}</dd></div>
          <div><dt>Matched</dt><dd>{data.summary.matchedCount}</dd></div>
          <div><dt>Cleared</dt><dd>{data.summary.clearedCount}</dd></div>
          <div><dt>Unmatched</dt><dd>{data.summary.unmatchedCount}</dd></div>
          <div><dt>Deposits</dt><dd>{data.summary.deposits}</dd></div>
          <div><dt>Withdrawals</dt><dd>{data.summary.withdrawals}</dd></div>
          <div><dt>Net</dt><dd>{data.summary.net}</dd></div>
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

      <Card title="Operator workflow">
        <p class="status-note">Use the Banking ledger for matching and completion actions so reconciliation detail review stays read-only.</p>
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
  .import-list {
    display: grid;
    gap: 10px;
  }
  .import-list a {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) minmax(76px, 0.65fr) auto minmax(84px, 0.6fr);
    align-items: center;
    gap: 10px;
    border: 1px solid var(--color-line);
    border-radius: 6px;
    padding: 10px;
    text-decoration: none;
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
    .import-list a {
      grid-template-columns: 1fr;
    }
  }
</style>
