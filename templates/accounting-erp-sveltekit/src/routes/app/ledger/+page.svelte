<script lang="ts">
  import { enhance } from "$app/forms";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data, form } = $props();

  const activeCount = $derived(data.accounts.filter((account) => account.active).length);
  const assets = $derived(data.accounts.filter((account) => account.type === "asset").length);
  const liabilities = $derived(data.accounts.filter((account) => account.type === "liability").length);
  const metrics = $derived<Metric[]>([
    { label: "Accounts", value: data.accounts.length, tone: "neutral", hint: `${activeCount} active` },
    { label: "Assets", value: assets, tone: "good", hint: "debit normal" },
    { label: "Liabilities", value: liabilities, tone: liabilities > 0 ? "warn" : "neutral", hint: "credit normal" }
  ]);
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
        <Badge tone={data.accounts.length > 0 ? "good" : "neutral"}>{data.accounts.length} accounts</Badge>
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
                  <td><code>{account.code}</code></td>
                  <td>
                    <strong>{account.name}</strong>
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
  </div>

  {#if data.canManage}
    <div class="content-grid mt-6">
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
    min-width: 620px;
    border-collapse: collapse;
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
  .form-row {
    display: grid;
    grid-template-columns: 0.8fr 1.4fr 1fr;
    gap: 12px;
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 720px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
