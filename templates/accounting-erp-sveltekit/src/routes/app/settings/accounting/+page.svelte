<script>
  import { Alert, Badge, Button, Card, Field, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const accountTone = $derived(data.setup.accountsConfigured ? "good" : "neutral");
  const periodTone = $derived(data.setup.fiscalPeriodsConfigured ? "good" : "neutral");
  const settingDefaults = $derived(form?.values ?? data.setup.settings ?? {});
  const receivableAccounts = $derived(data.accounts.filter((account) => account.type === "asset" && account.active && !account.isHeader));
  const depositAccounts = $derived(data.accounts.filter((account) => account.type === "asset" && account.active && !account.isHeader));
  const payableAccounts = $derived(data.accounts.filter((account) => account.type === "liability" && account.active && !account.isHeader));
  const incomeAccounts = $derived(data.accounts.filter((account) => account.type === "revenue" && account.active && !account.isHeader));

  function accountLabel(account) {
    return `${account.code} ${account.name}`;
  }
</script>

<svelte:head>
  <title>Accounting Settings · Accounting ERP</title>
</svelte:head>

<main class="section accounting-settings">
  <PageHeader
    eyebrow="Accounting settings"
    title="Accounting setup"
    description="Chart metadata, setup status, and fiscal period generation."
  />

  {#if form?.seededAccounts}
    <Alert tone="success">Seeded {form.accountCount} {String(form.standard ?? "gaap").toUpperCase()} chart accounts in {form.baseCurrency}.</Alert>
  {:else if form?.savedDefaults}
    <Alert tone="success">Saved default posting accounts.</Alert>
  {:else if form?.seededPeriods}
    <Alert tone="success">Generated {form.periodCount} fiscal periods.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card title="Setup status">
      <div class="status-grid">
        <div>
          <span>Chart of accounts</span>
          <strong>{data.setup.accountCount}</strong>
          <Badge tone={accountTone}>{data.setup.accountsConfigured ? "configured" : "empty"}</Badge>
        </div>
        <div>
          <span>Base currency</span>
          <strong>{data.setup.baseCurrency ?? "-"}</strong>
          <Badge tone={data.setup.baseCurrency ? "good" : "neutral"}>{data.setup.baseCurrency ? "configured" : "empty"}</Badge>
        </div>
        <div>
          <span>Default accounts</span>
          <strong>{data.setup.defaultAccountsConfigured ? "Ready" : "Open"}</strong>
          <Badge tone={data.setup.defaultAccountsConfigured ? "good" : "neutral"}>{data.setup.defaultAccountsConfigured ? "configured" : "empty"}</Badge>
        </div>
        <div>
          <span>Fiscal periods</span>
          <strong>{data.setup.fiscalPeriodCount}</strong>
          <Badge tone={periodTone}>{data.setup.fiscalPeriodsConfigured ? "configured" : "empty"}</Badge>
        </div>
      </div>
    </Card>

    <Card title="Chart of accounts">
      <p class="muted">
        GAAP or IFRS starter chart with account hierarchy, system accounts, reconcilable bank accounts, and contra-account balances.
      </p>
      {#if data.canManage}
        <form method="POST" action="?/seedAccounts" class="account-form">
          <Field label="Standard" id="standard">
            <select id="standard" name="standard" disabled={data.setup.accountsConfigured}>
              {#each data.chartStandards as standard}
                <option value={standard.value} selected={(form?.values?.standard ?? "gaap") === standard.value}>{standard.label}</option>
              {/each}
            </select>
          </Field>
          <Field label="Base currency" id="baseCurrency">
            <select id="baseCurrency" name="baseCurrency" disabled={data.setup.accountsConfigured}>
              {#each data.baseCurrencies as currency}
                <option value={currency} selected={(form?.values?.baseCurrency ?? "USD") === currency}>{currency}</option>
              {/each}
            </select>
          </Field>
          <Button type="submit" variant="primary" disabled={data.setup.accountsConfigured}>Seed chart</Button>
        </form>
      {/if}
    </Card>

    <Card title="Default posting accounts">
      <form method="POST" action="?/saveDefaults" class="defaults-form">
        <Field label="Accounts receivable" id="defaultArAccountId">
          <select id="defaultArAccountId" name="defaultArAccountId" disabled={!data.canManage || !data.setup.accountsConfigured}>
            <option value="">Not set</option>
            {#each receivableAccounts as account}
              <option value={account.id} selected={settingDefaults.defaultArAccountId === account.id}>{accountLabel(account)}</option>
            {/each}
          </select>
        </Field>
        <Field label="Accounts payable" id="defaultApAccountId">
          <select id="defaultApAccountId" name="defaultApAccountId" disabled={!data.canManage || !data.setup.accountsConfigured}>
            <option value="">Not set</option>
            {#each payableAccounts as account}
              <option value={account.id} selected={settingDefaults.defaultApAccountId === account.id}>{accountLabel(account)}</option>
            {/each}
          </select>
        </Field>
        <Field label="Sales revenue" id="defaultIncomeAccountId">
          <select id="defaultIncomeAccountId" name="defaultIncomeAccountId" disabled={!data.canManage || !data.setup.accountsConfigured}>
            <option value="">Not set</option>
            {#each incomeAccounts as account}
              <option value={account.id} selected={settingDefaults.defaultIncomeAccountId === account.id}>{accountLabel(account)}</option>
            {/each}
          </select>
        </Field>
        <Field label="Payment deposit" id="defaultDepositAccountId">
          <select id="defaultDepositAccountId" name="defaultDepositAccountId" disabled={!data.canManage || !data.setup.accountsConfigured}>
            <option value="">Not set</option>
            {#each depositAccounts as account}
              <option value={account.id} selected={settingDefaults.defaultDepositAccountId === account.id}>{accountLabel(account)}</option>
            {/each}
          </select>
        </Field>
        <Field label="Stripe deposit" id="stripeDepositAccountId">
          <select id="stripeDepositAccountId" name="stripeDepositAccountId" disabled={!data.canManage || !data.setup.accountsConfigured}>
            <option value="">Use payment deposit</option>
            {#each depositAccounts as account}
              <option value={account.id} selected={settingDefaults.stripeDepositAccountId === account.id}>{accountLabel(account)}</option>
            {/each}
          </select>
        </Field>
        {#if data.canManage}
          <Button type="submit" variant="primary" disabled={!data.setup.accountsConfigured}>Save defaults</Button>
        {/if}
      </form>
    </Card>

    <Card title="Fiscal periods">
      <form method="POST" action="?/seedPeriods" class="period-form">
        <Field label="Fiscal year" id="year">
          <input
            id="year"
            name="year"
            type="number"
            min="1900"
            max="9999"
            value={form?.values?.year ?? data.currentYear}
            disabled={!data.canManage || data.setup.fiscalPeriodsConfigured}
          />
        </Field>
        <Field label="Start month" id="fiscalYearStartMonth">
          <select
            id="fiscalYearStartMonth"
            name="fiscalYearStartMonth"
            disabled={!data.canManage || data.setup.fiscalPeriodsConfigured}
          >
            {#each [
              ["1", "January"],
              ["2", "February"],
              ["3", "March"],
              ["4", "April"],
              ["5", "May"],
              ["6", "June"],
              ["7", "July"],
              ["8", "August"],
              ["9", "September"],
              ["10", "October"],
              ["11", "November"],
              ["12", "December"]
            ] as month}
              <option value={month[0]} selected={String(form?.values?.fiscalYearStartMonth ?? 1) === month[0]}>{month[1]}</option>
            {/each}
          </select>
        </Field>
        {#if data.canManage}
          <Button type="submit" variant="primary" disabled={data.setup.fiscalPeriodsConfigured}>Generate periods</Button>
        {/if}
      </form>
    </Card>
  </div>
</main>

<style>
  .accounting-settings {
    display: grid;
    gap: 18px;
  }
  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .status-grid div,
  .account-form,
  .defaults-form,
  .period-form {
    display: grid;
    gap: 10px;
  }
  .status-grid div {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-panel-subtle);
    padding: 14px;
  }
  .status-grid span,
  .muted {
    color: var(--color-ink-soft);
  }
  .status-grid strong {
    color: var(--color-ink);
    font-size: 1.6rem;
    line-height: 1;
  }
  .muted {
    margin-block: 0 16px;
  }
  @media (max-width: 720px) {
    .status-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
