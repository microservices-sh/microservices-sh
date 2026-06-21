<script>
  import { enhance } from "$app/forms";
  import { money } from "$lib/format";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const activeCount = $derived(data.accounts.filter((account) => account.active).length);
  const assets = $derived(data.accounts.filter((account) => account.type === "asset").length);
  const liabilities = $derived(data.accounts.filter((account) => account.type === "liability").length);
  const activePeriod = $derived(data.fiscalPeriods.find((period) => period.id === data.activePeriodId) ?? null);
  const postingAccounts = $derived(data.accounts.filter((account) => account.active && !account.isHeader));
  const trialBalanceLines = $derived(data.trialBalance?.lines ?? []);
  const metrics = $derived([
    { label: "Accounts", value: data.accounts.length, tone: "neutral", hint: `${activeCount} active` },
    { label: "Periods", value: data.fiscalPeriods.length, tone: activePeriod ? "good" : "warn", hint: activePeriod?.name ?? "none open" },
    {
      label: "Trial balance",
      value: money(data.trialBalance?.totalDebitCents ?? 0),
      tone: data.trialBalance?.balanced ? "good" : "bad",
      hint: data.trialBalance?.balanced ? "debit = credit" : "out of balance"
    }
  ]);

  function statusTone(status) {
    if (status === "open") return "good";
    if (status === "closed") return "warn";
    if (status === "locked") return "bad";
    return "neutral";
  }
</script>

<svelte:head>
  <title>Ledger · Accounting ERP</title>
</svelte:head>

<main class="section ledger-page">
  <PageHeader
    eyebrow="General ledger"
    title="Ledger"
    description="Chart of accounts from the StackSuite accounting-core module."
  >
    {#snippet actions()}
      <Button href="/app/payables" variant="ghost">Payables</Button>
    {/snippet}
  </PageHeader>

  {#if form?.created}
    <Alert tone="success">Account created.</Alert>
  {:else if form?.fiscalPeriodCreated}
    <Alert tone="success">Fiscal period created.</Alert>
  {:else if form?.fiscalPeriodStatusUpdated}
    <Alert tone="success">Fiscal period status updated.</Alert>
  {:else if form?.journalCreated}
    <Alert tone="success">Journal draft created: <code>{form.journalEntryId}</code>.</Alert>
  {:else if form?.journalPosted}
    <Alert tone="success">Journal entry posted.</Alert>
  {:else if form?.journalVoided}
    <Alert tone="success">Journal entry voided. Reversal: <code>{form.reversalEntryId}</code>.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="content-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Chart of accounts</h2>
        <Badge tone={data.accounts.length > 0 ? "good" : "neutral"}>{assets} asset / {liabilities} liability</Badge>
      </div>
      {#if data.accounts.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Chart of accounts</caption>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Normal</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {#each data.accounts as account (account.id)}
                <tr>
                  <td><a href={`/app/ledger/accounts/${account.id}`}><code>{account.code}</code></a></td>
                  <td>
                    <strong><a href={`/app/ledger/accounts/${account.id}`}>{account.name}</a></strong>
                    {#if account.description}<span>{account.description}</span>{/if}
                  </td>
                  <td>{account.type}</td>
                  <td>{account.normalBalance}</td>
                  <td><Badge tone={account.active ? "good" : "neutral"}>{account.active ? "active" : "inactive"}</Badge></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No accounts have been created yet.</p>
      {/if}
    </Card>

    <Card>
      <div class="card-headline">
        <h2>Fiscal periods</h2>
        <Badge tone={activePeriod ? "good" : "warn"}>{activePeriod?.name ?? "no active period"}</Badge>
      </div>
      {#if data.fiscalPeriods.length > 0}
        <div class="table-scroll">
          <table class="period-table">
            <caption>Fiscal periods</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Dates</th>
                <th scope="col">Status</th>
                {#if data.canManage}<th scope="col">Set</th>{/if}
              </tr>
            </thead>
            <tbody>
              {#each data.fiscalPeriods as period (period.id)}
                <tr>
                  <td>
                    <strong>{period.name}</strong>
                    <span><code>{period.id}</code></span>
                  </td>
                  <td>{period.startsOn} - {period.endsOn}</td>
                  <td><Badge tone={statusTone(period.status)}>{period.status}</Badge></td>
                  {#if data.canManage}
                    <td>
                      <form class="inline-form" method="POST" action="?/updateFiscalPeriodStatus" use:enhance>
                        <input type="hidden" name="periodId" value={period.id} />
                        <select name="status" aria-label="Period status">
                          <option value="open" selected={period.status === "open"}>open</option>
                          <option value="closed" selected={period.status === "closed"}>closed</option>
                          <option value="locked" selected={period.status === "locked"}>locked</option>
                        </select>
                        <Button type="submit" size="sm" variant="ghost">Save</Button>
                      </form>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No fiscal periods have been created yet.</p>
      {/if}
    </Card>
  </div>

  <div class="content-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Trial balance</h2>
        <Badge tone={data.trialBalance?.balanced ? "good" : "bad"}>
          {data.trialBalance?.balanced ? "balanced" : "unbalanced"}
        </Badge>
      </div>
      {#if trialBalanceLines.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Trial balance</caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Type</th>
                <th scope="col">Debit</th>
                <th scope="col">Credit</th>
                <th scope="col">Balance</th>
              </tr>
            </thead>
            <tbody>
              {#each trialBalanceLines as line (line.accountId)}
                <tr>
                  <td>
                    <strong><a href={`/app/ledger/accounts/${line.accountId}`}>{line.accountCode} · {line.accountName}</a></strong>
                    <span>{line.normalBalance} normal</span>
                  </td>
                  <td>{line.accountType}</td>
                  <td>{money(line.debitCents)}</td>
                  <td>{money(line.creditCents)}</td>
                  <td>{money(line.balanceCents)}</td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colspan="2">Totals</th>
                <td>{money(data.trialBalance?.totalDebitCents ?? 0)}</td>
                <td>{money(data.trialBalance?.totalCreditCents ?? 0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      {:else}
        <p class="empty">No posted journal activity for {activePeriod?.name ?? "the selected scope"}.</p>
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="form-grid mt-6">
      <Card title="Create account">
        <form method="POST" action="?/create" use:enhance>
          <div class="form-row">
            <Field label="Code" id="account-code"><input id="account-code" name="code" required placeholder="1000" value={form?.values?.code ?? ""} /></Field>
            <Field label="Name" id="account-name"><input id="account-name" name="name" required placeholder="Cash" value={form?.values?.name ?? ""} /></Field>
            <Field label="Type" id="account-type">
              <select id="account-type" name="type" required>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </Field>
          </div>
          <Field label="Description" id="account-description"><textarea id="account-description" name="description" rows="3">{form?.values?.description ?? ""}</textarea></Field>
          <Button type="submit" variant="primary">Create account</Button>
        </form>
      </Card>

      <Card title="Create fiscal period">
        <form method="POST" action="?/createFiscalPeriod" use:enhance>
          <Field label="Name" id="period-name"><input id="period-name" name="name" required placeholder="June 2026" value={form?.values?.name ?? ""} /></Field>
          <div class="form-row">
            <Field label="Starts on" id="period-start"><input id="period-start" name="startsOn" type="date" required value={form?.values?.startsOn ?? data.today} /></Field>
            <Field label="Ends on" id="period-end"><input id="period-end" name="endsOn" type="date" required value={form?.values?.endsOn ?? data.today} /></Field>
          </div>
          <Field label="Status" id="period-status">
            <select id="period-status" name="status" required>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="locked">Locked</option>
            </select>
          </Field>
          <Button type="submit" variant="primary">Create period</Button>
        </form>
      </Card>
    </div>

    <div class="form-grid mt-6">
      <Card title="Create journal entry">
        <form method="POST" action="?/createJournalEntry" use:enhance>
          <div class="form-row">
            <Field label="Period" id="journal-period">
              <select id="journal-period" name="periodId" required disabled={data.fiscalPeriods.length === 0}>
                <option value="">Choose period</option>
                {#each data.fiscalPeriods as period (period.id)}
                  <option value={period.id} selected={period.id === data.activePeriodId}>{period.name} · {period.status}</option>
                {/each}
              </select>
            </Field>
            <Field label="Entry date" id="journal-date"><input id="journal-date" name="entryDate" type="date" required value={form?.values?.entryDate ?? data.today} /></Field>
          </div>
          <Field label="Description" id="journal-description"><input id="journal-description" name="description" required placeholder="Owner contribution" value={form?.values?.description ?? ""} /></Field>
          <div class="form-row">
            <Field label="Debit account" id="journal-debit">
              <select id="journal-debit" name="debitAccountId" required disabled={postingAccounts.length === 0}>
                <option value="">Choose account</option>
                {#each postingAccounts as account (account.id)}
                  <option value={account.id}>{account.code} · {account.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Credit account" id="journal-credit">
              <select id="journal-credit" name="creditAccountId" required disabled={postingAccounts.length === 0}>
                <option value="">Choose account</option>
                {#each postingAccounts as account (account.id)}
                  <option value={account.id}>{account.code} · {account.name}</option>
                {/each}
              </select>
            </Field>
          </div>
          <div class="form-row">
            <Field label="Amount" id="journal-amount"><input id="journal-amount" name="amount" type="number" min="0.01" step="0.01" required value={form?.values?.amount ?? ""} /></Field>
            <Field label="Source ref" id="journal-source"><input id="journal-source" name="sourceRef" placeholder="manual:1001" value={form?.values?.sourceRef ?? ""} /></Field>
          </div>
          <Button type="submit" variant="primary" disabled={data.fiscalPeriods.length === 0 || postingAccounts.length < 2}>Create draft</Button>
        </form>
      </Card>

      <Card title="Post or void journal entry">
        <form method="POST" action="?/postJournalEntry" use:enhance>
          <div class="action-row">
            <Field label="Draft entry ID" id="post-entry-id"><input id="post-entry-id" name="entryId" required placeholder="je_..." value={form?.values?.entryId ?? ""} /></Field>
            <Button type="submit" variant="primary">Post</Button>
          </div>
        </form>
        <form class="stacked-form" method="POST" action="?/voidJournalEntry" use:enhance>
          <Field label="Posted entry ID" id="void-entry-id"><input id="void-entry-id" name="entryId" required placeholder="je_..." value={form?.values?.entryId ?? ""} /></Field>
          <Field label="Reason" id="void-reason"><input id="void-reason" name="reason" placeholder="Duplicate posting" value={form?.values?.reason ?? ""} /></Field>
          <div class="form-row">
            <Field label="Reversal date" id="void-date"><input id="void-date" name="reversalDate" type="date" value={form?.values?.reversalDate ?? data.today} /></Field>
            <Field label="Reversal period" id="void-period">
              <select id="void-period" name="reversalPeriodId">
                <option value="">Use original period</option>
                {#each data.fiscalPeriods as period (period.id)}
                  <option value={period.id} selected={period.id === data.activePeriodId}>{period.name}</option>
                {/each}
              </select>
            </Field>
          </div>
          <Button type="submit" variant="ghost">Void with reversal</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .ledger-page :global(.card__body) {
    min-width: 0;
  }
  .card-headline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-block-end: 14px;
  }
  .table-scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 680px;
    border-collapse: collapse;
  }
  .period-table {
    min-width: 560px;
  }
  caption {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  th,
  td {
    border-block-end: 1px solid var(--color-line);
    padding: 10px 8px;
    text-align: left;
    font-size: 0.86rem;
  }
  th {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  td span {
    display: block;
    color: var(--color-ink-faint);
    font-size: 0.8rem;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  tfoot th,
  tfoot td {
    border-block-end: 0;
    font-weight: 700;
  }
  .inline-form {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) auto;
    gap: 8px;
    align-items: center;
  }
  .form-grid {
    display: grid;
    grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.1fr);
    gap: 16px;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .action-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: end;
  }
  .stacked-form {
    margin-block-start: 18px;
    padding-block-start: 18px;
    border-block-start: 1px solid var(--color-line);
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 860px) {
    .form-grid,
    .form-row {
      grid-template-columns: 1fr;
    }
    .action-row {
      grid-template-columns: 1fr;
    }
  }
</style>
