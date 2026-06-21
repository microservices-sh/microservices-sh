<script>
  import { Badge, Button, Card, PageHeader } from "$lib/ui";

  let { data } = $props();
  const account = $derived(data.account);
</script>

<svelte:head>
  <title>{account.code} · {account.name} · Ledger · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Ledger account" title={`${account.code} · ${account.name}`}>
    {#snippet actions()}
      <Button href="/app/ledger" variant="ghost">&larr; Ledger</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={account.tone}>{account.active ? "active" : "inactive"}</Badge>
      <span>·</span>
      <span>{account.type}</span>
      {#if account.subtype}
        <span>·</span>
        <span>{account.subtype}</span>
      {/if}
    {/snippet}
  </PageHeader>

  <div class="grid">
    <div class="grid__main">
      <Card title="Account profile">
        <dl class="detail-list">
          <div><dt>Code</dt><dd><code>{account.code}</code></dd></div>
          <div><dt>Name</dt><dd>{account.name}</dd></div>
          <div><dt>Type</dt><dd>{account.type}</dd></div>
          <div><dt>Subtype</dt><dd>{account.subtype ?? "-"}</dd></div>
          <div><dt>Normal balance</dt><dd>{account.normalBalance}</dd></div>
          <div><dt>Currency</dt><dd>{account.currency}</dd></div>
          <div><dt>Parent</dt><dd>{data.parent ? `${data.parent.code} · ${data.parent.name}` : "Top level"}</dd></div>
          <div><dt>Created</dt><dd>{account.created}</dd></div>
          <div><dt>Updated</dt><dd>{account.updated}</dd></div>
        </dl>
      </Card>

      <Card title="Child accounts">
        {#if data.children.length > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each data.children as child (child.id)}
                  <tr>
                    <td><a href={`/app/ledger/accounts/${child.id}`}><code>{child.code}</code></a></td>
                    <td>
                      <strong>{child.name}</strong>
                      {#if child.isHeader}<span>Header account</span>{/if}
                    </td>
                    <td>{child.type}</td>
                    <td><Badge tone={child.active ? "good" : "neutral"}>{child.active ? "active" : "inactive"}</Badge></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No child accounts are nested under this account.</p>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Balance">
        <dl class="detail-list">
          <div><dt>Balance</dt><dd><Badge tone={account.balanceTone}>{account.balance}</Badge></dd></div>
          <div><dt>Debit</dt><dd class="num">{account.debit}</dd></div>
          <div><dt>Credit</dt><dd class="num">{account.credit}</dd></div>
          <div><dt>Trial balance</dt><dd>{data.trialBalance?.balanced ? "Balanced" : "Unbalanced"}</dd></div>
          <div><dt>Total debit</dt><dd class="num">{data.trialBalance?.totalDebit ?? "-"}</dd></div>
          <div><dt>Total credit</dt><dd class="num">{data.trialBalance?.totalCredit ?? "-"}</dd></div>
        </dl>
      </Card>

      <Card title="Posting policy">
        <dl class="detail-list">
          <div><dt>System</dt><dd>{account.isSystem ? "Yes" : "No"}</dd></div>
          <div><dt>Reconcilable</dt><dd>{account.isReconcilable ? "Yes" : "No"}</dd></div>
          <div><dt>Header</dt><dd>{account.isHeader ? "Yes" : "No"}</dd></div>
          <div><dt>Postable</dt><dd>{account.active && !account.isHeader ? "Yes" : "No"}</dd></div>
        </dl>
      </Card>

      {#if account.description}
        <Card title="Description">
          <p class="status-note">{account.description}</p>
        </Card>
      {/if}

      <Card title="Operator workflow">
        <p class="status-note">Use the Ledger page for account creation and journal posting actions so account detail review stays read-only.</p>
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
    min-width: 560px;
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
  td span {
    display: block;
    color: var(--color-ink-faint);
    font-size: 0.78rem;
  }
  code {
    font-size: 0.78rem;
  }
  .num {
    font-variant-numeric: tabular-nums;
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
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
