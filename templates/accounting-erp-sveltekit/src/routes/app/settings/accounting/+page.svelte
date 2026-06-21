<script lang="ts">
  import { Alert, Badge, Button, Card, Field, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const accountTone = $derived(data.setup.accountsConfigured ? "good" : "neutral");
  const periodTone = $derived(data.setup.fiscalPeriodsConfigured ? "good" : "neutral");
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
    <Alert tone="success">Seeded {form.accountCount} chart accounts.</Alert>
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
          <span>Fiscal periods</span>
          <strong>{data.setup.fiscalPeriodCount}</strong>
          <Badge tone={periodTone}>{data.setup.fiscalPeriodsConfigured ? "configured" : "empty"}</Badge>
        </div>
      </div>
    </Card>

    <Card title="Chart of accounts">
      <p class="muted">
        GAAP starter chart with account hierarchy, system accounts, reconcilable bank accounts, and contra-account balances.
      </p>
      {#if data.canManage}
        <form method="POST" action="?/seedAccounts">
          <Button type="submit" variant="primary" disabled={data.setup.accountsConfigured}>Seed GAAP chart</Button>
        </form>
      {/if}
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .status-grid div,
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
