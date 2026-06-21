<script>
  import { Badge, Button, Card, PageHeader } from "$lib/ui";

  let { data } = $props();
  const period = $derived(data.period);
</script>

<svelte:head>
  <title>{period.name} · Fiscal period · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Fiscal period" title={period.name}>
    {#snippet actions()}
      <Button href="/app/ledger" variant="ghost">&larr; Ledger</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={period.statusTone}>{period.status}</Badge>
      {#if period.isCurrent}
        <span>·</span>
        <Badge tone="info">current</Badge>
      {/if}
      <span>·</span>
      <span>{period.startsOnShort} - {period.endsOnShort}</span>
    {/snippet}
  </PageHeader>

  <div class="grid">
    <div class="grid__main">
      <Card title="Period profile">
        <dl class="detail-list">
          <div><dt>Name</dt><dd>{period.name}</dd></div>
          <div><dt>Start</dt><dd>{period.startsOnShort}</dd></div>
          <div><dt>End</dt><dd>{period.endsOnShort}</dd></div>
          <div><dt>Length</dt><dd>{period.dayCount} days</dd></div>
          <div><dt>Status</dt><dd><Badge tone={period.statusTone}>{period.status}</Badge></dd></div>
          <div><dt>Posting</dt><dd>{period.postingAllowed ? "Allowed" : "Blocked"}</dd></div>
          <div><dt>Created</dt><dd>{period.created}</dd></div>
          <div><dt>Updated</dt><dd>{period.updated}</dd></div>
        </dl>
      </Card>

      <Card title="Trial balance activity">
        {#if data.trialBalance && data.trialBalance.lines.length > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {#each data.trialBalance.lines as line (line.accountId)}
                  <tr>
                    <td>
                      <strong><a href={`/app/ledger/accounts/${line.accountId}`}>{line.accountCode} · {line.accountName}</a></strong>
                      <span>{line.normalBalance} normal</span>
                    </td>
                    <td>{line.accountType}</td>
                    <td class="num">{line.debit}</td>
                    <td class="num">{line.credit}</td>
                    <td class="num">{line.balance}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr>
                  <th colspan="2">Totals</th>
                  <td class="num">{data.trialBalance.totalDebit}</td>
                  <td class="num">{data.trialBalance.totalCredit}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        {:else}
          <p class="empty">No posted journal activity is recorded in this period.</p>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Period totals">
        <dl class="detail-list">
          <div><dt>Balanced</dt><dd>{data.trialBalance?.balanced ? "Yes" : "No"}</dd></div>
          <div><dt>Debit</dt><dd class="num">{data.trialBalance?.totalDebit ?? "-"}</dd></div>
          <div><dt>Credit</dt><dd class="num">{data.trialBalance?.totalCredit ?? "-"}</dd></div>
          <div><dt>Active accounts</dt><dd>{data.trialBalance?.activityCount ?? 0}</dd></div>
        </dl>
      </Card>

      <Card title="Fiscal year">
        <dl class="detail-list">
          <div><dt>Year</dt><dd>{data.fiscalYear.year}</dd></div>
          <div><dt>Total periods</dt><dd>{data.fiscalYear.total}</dd></div>
          <div><dt>Open</dt><dd>{data.fiscalYear.open}</dd></div>
          <div><dt>Closed</dt><dd>{data.fiscalYear.closed}</dd></div>
          <div><dt>Locked</dt><dd>{data.fiscalYear.locked}</dd></div>
        </dl>
      </Card>

      <Card title="Adjacent periods">
        <div class="adjacent-list">
          {#each data.adjacentPeriods as item}
            <div class="adjacent-item">
              <span>{item.label}</span>
              {#if item.period}
                <a href={`/app/ledger/fiscal-periods/${item.period.id}`}>{item.period.name}</a>
                <small>{item.period.startsOn} - {item.period.endsOn}</small>
                <Badge tone={item.period.statusTone}>{item.period.status}</Badge>
              {:else}
                <strong>None</strong>
              {/if}
            </div>
          {/each}
        </div>
      </Card>

      <Card title="Close policy">
        <dl class="detail-list">
          <div><dt>Closed</dt><dd>{period.closed || "-"}</dd></div>
          <div><dt>Locked</dt><dd>{period.locked || "-"}</dd></div>
        </dl>
        <p class="status-note">Open periods accept posting. Closed and locked periods reject new postings; use the Ledger page for create, close, reopen, and lock actions.</p>
        <Button href="/app/ledger" variant="ghost">Open ledger actions</Button>
      </Card>
    </div>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
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
    min-width: 660px;
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
  .adjacent-item small {
    display: block;
    color: var(--color-ink-faint);
    font-size: 0.78rem;
  }
  tfoot th,
  tfoot td {
    border-block-end: 0;
    font-weight: 700;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .adjacent-list {
    display: grid;
    gap: 12px;
  }
  .adjacent-item {
    display: grid;
    gap: 4px;
    border-block-end: 1px solid var(--color-line);
    padding-block-end: 12px;
  }
  .adjacent-item:last-child {
    border-block-end: 0;
    padding-block-end: 0;
  }
  .adjacent-item > span {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .status-note,
  .empty {
    margin: 0;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .detail-list + .status-note {
    margin-block-start: 14px;
  }
  .status-note + :global(a),
  .status-note + :global(button) {
    margin-block-start: 14px;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
