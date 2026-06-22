<script>
  import { money } from "$lib/format";
  import { Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";

  let { data } = $props();

  const arOpen = $derived(data.arAging?.totalOpenCents ?? 0);
  const apOpen = $derived(data.apAging?.totals.totalCents ?? 0);
  const totalOverdue = $derived((data.arAging?.overdueCents ?? 0) + (data.apAging?.overdueCents ?? 0));
  const netIncome = $derived(data.incomeStatement?.netIncomeCents ?? 0);
  const metrics = $derived([
    { label: "Open AR", value: money(arOpen), tone: arOpen > 0 ? "warn" : "good", hint: `${data.openReceivables.length} invoices` },
    { label: "Open AP", value: money(apOpen), tone: apOpen > 0 ? "warn" : "good", hint: `${data.apAging?.vendors.length ?? 0} vendors` },
    { label: "Overdue", value: money(totalOverdue), tone: totalOverdue > 0 ? "bad" : "good", hint: data.asOfDay },
    { label: "Net income", value: money(netIncome), tone: netIncome >= 0 ? "good" : "bad", hint: `${data.statementStartDate} to ${data.asOfDay}` }
  ]);

  const buckets = [
    ["Current", "currentCents"],
    ["1-30", "days1To30Cents"],
    ["31-60", "days31To60Cents"],
    ["61-90", "days61To90Cents"],
    ["90+", "days90PlusCents"]
  ];

  function bucketTone(label) {
    if (label === "Current") return "good";
    if (label === "90+" || label === "61-90") return "bad";
    return "warn";
  }

  function section(report, key) {
    return report?.sections.find((item) => item.key === key) ?? { lines: [], totalCents: 0 };
  }

  function statementLines(report) {
    return report?.sections.flatMap((item) => item.lines.map((line) => ({ ...line, section: item.label }))) ?? [];
  }
</script>

<svelte:head>
  <title>Reports · Accounting ERP</title>
</svelte:head>

<main class="section reports-page">
  <PageHeader
    eyebrow="Accounting reports"
    title="Reports"
    description="Financial statements, aged receivables, aged payables, and customer statement outputs from the accounting modules."
  >
    {#snippet actions()}
      <Button href="/app/ledger" variant="ghost">Ledger</Button>
      <Button href="/app/receivables" variant="ghost">Receivables</Button>
      <Button href="/app/payables" variant="ghost">Payables</Button>
    {/snippet}
  </PageHeader>

  <form class="report-filter mt-6" method="GET">
    <Field label="From" id="report-start-date">
      <input id="report-start-date" name="startDate" type="date" value={data.startDate ?? ""} />
    </Field>
    <Field label="As of" id="report-as-of">
      <input id="report-as-of" name="asOf" type="date" value={data.asOfDay} />
    </Field>
    <Field label="General ledger" id="report-account">
      <select id="report-account" name="accountId">
        <option value="">No ledger</option>
        {#each data.accounts as account (account.id)}
          <option value={account.id} selected={data.selectedAccountId === account.id}>{account.code} · {account.name}</option>
        {/each}
      </select>
    </Field>
    <Field label="Customer statement" id="report-customer">
      <select id="report-customer" name="customerId">
        <option value="">No statement</option>
        {#each data.customers as customer (customer.id)}
          <option value={customer.id} selected={data.selectedCustomerId === customer.id}>{customer.name}</option>
        {/each}
      </select>
    </Field>
    <Button type="submit" variant="primary">Run</Button>
  </form>

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="statement-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Income statement</h2>
        <Badge tone={netIncome >= 0 ? "good" : "bad"}>{money(netIncome)}</Badge>
      </div>
      {#if data.incomeStatement}
        <div class="statement-summary">
          <div><span>Revenue</span><strong>{money(data.incomeStatement.totalRevenueCents)}</strong></div>
          <div><span>Expenses</span><strong>{money(data.incomeStatement.totalExpenseCents)}</strong></div>
          <div><span>Net</span><strong>{money(data.incomeStatement.netIncomeCents)}</strong></div>
        </div>
        <div class="statement-lines">
          {#each data.incomeStatement.sections as item (item.key)}
            <div>
              <span>{item.label}</span>
              <strong>{money(item.totalCents)}</strong>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty">No posted income statement activity.</p>
      {/if}
    </Card>

    <Card>
      <div class="card-headline">
        <h2>Balance sheet</h2>
        <Badge tone={data.balanceSheet?.balanced ? "good" : "bad"}>{data.balanceSheet?.balanced ? "balanced" : "review"}</Badge>
      </div>
      {#if data.balanceSheet}
        <div class="statement-summary">
          <div><span>Assets</span><strong>{money(data.balanceSheet.totalAssetsCents)}</strong></div>
          <div><span>Liabilities</span><strong>{money(data.balanceSheet.totalLiabilitiesCents)}</strong></div>
          <div><span>Equity</span><strong>{money(data.balanceSheet.totalEquityCents)}</strong></div>
        </div>
        <div class="statement-lines">
          {#each data.balanceSheet.sections as item (item.key)}
            <div>
              <span>{item.label}</span>
              <strong>{money(item.totalCents)}</strong>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty">No posted balance sheet activity.</p>
      {/if}
    </Card>

    <Card>
      <div class="card-headline">
        <h2>Cash flow</h2>
        <Badge tone={(data.cashFlowStatement?.netCashChangeCents ?? 0) >= 0 ? "good" : "warn"}>{money(data.cashFlowStatement?.endingCashCents ?? 0)}</Badge>
      </div>
      {#if data.cashFlowStatement}
        <div class="statement-summary">
          <div><span>Beginning</span><strong>{money(data.cashFlowStatement.beginningCashCents)}</strong></div>
          <div><span>Change</span><strong>{money(data.cashFlowStatement.netCashChangeCents)}</strong></div>
          <div><span>Ending</span><strong>{money(data.cashFlowStatement.endingCashCents)}</strong></div>
        </div>
        <div class="statement-lines">
          {#each data.cashFlowStatement.sections as item (item.key)}
            <div>
              <span>{item.label}</span>
              <strong>{money(item.totalCents)}</strong>
            </div>
          {/each}
        </div>
        {#if section(data.cashFlowStatement, "unclassified").totalCents !== 0}
          <p class="review-note">Unclassified cash activity needs account/source review.</p>
        {/if}
      {:else}
        <p class="empty">No cash accounts or posted cash activity.</p>
      {/if}
    </Card>
  </div>

  {#if statementLines(data.incomeStatement).length > 0 || statementLines(data.balanceSheet).length > 0}
    <Card class="mt-6">
      <div class="card-headline">
        <h2>Statement lines</h2>
        <Badge tone="neutral">{data.statementStartDate} to {data.asOfDay}</Badge>
      </div>
      <div class="table-scroll mt-4">
        <table>
          <caption>Financial statement account lines</caption>
          <thead>
            <tr>
              <th scope="col">Statement</th>
              <th scope="col">Section</th>
              <th scope="col">Account</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each statementLines(data.incomeStatement) as line (`income-${line.section}-${line.accountCode}`)}
              <tr>
                <td>Income</td>
                <td>{line.section}</td>
                <td>{line.accountCode} · {line.accountName}</td>
                <td>{money(line.amountCents)}</td>
              </tr>
            {/each}
            {#each statementLines(data.balanceSheet) as line (`balance-${line.section}-${line.accountCode}`)}
              <tr>
                <td>Balance</td>
                <td>{line.section}</td>
                <td>{line.accountCode} · {line.accountName}</td>
                <td>{money(line.amountCents)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}

  <div class="report-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Aged receivables</h2>
        <Badge tone={(data.arAging?.overdueCents ?? 0) > 0 ? "bad" : "good"}>{money(data.arAging?.totalOpenCents ?? 0)}</Badge>
      </div>
      {#if data.arAging}
        <div class="bucket-grid">
          {#each buckets as [label, key]}
            <div>
              <span>{label}</span>
              <strong>{money(data.arAging[key])}</strong>
              <Badge tone={bucketTone(label)}>{label}</Badge>
            </div>
          {/each}
        </div>
      {/if}
      {#if data.openReceivables.length > 0}
        <div class="table-scroll mt-4">
          <table>
            <caption>Open receivables</caption>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Customer</th>
                <th scope="col">Due</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {#each data.openReceivables as invoice (invoice.id)}
                <tr>
                  <td><code>{invoice.invoiceNumber}</code></td>
                  <td>{invoice.customerName}</td>
                  <td>{invoice.daysOverdue > 0 ? `${invoice.daysOverdue} days` : "current"}</td>
                  <td>{money(invoice.amountDueCents)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No open receivables.</p>
      {/if}
    </Card>

    <Card>
      <div class="card-headline">
        <h2>Aged payables</h2>
        <Badge tone={(data.apAging?.overdueCents ?? 0) > 0 ? "bad" : "good"}>{money(data.apAging?.totals.totalCents ?? 0)}</Badge>
      </div>
      {#if data.apAging}
        <div class="bucket-grid">
          {#each buckets as [label, key]}
            <div>
              <span>{label}</span>
              <strong>{money(data.apAging.totals[key])}</strong>
              <Badge tone={bucketTone(label)}>{label}</Badge>
            </div>
          {/each}
        </div>
        {#if data.apAging.vendors.length > 0}
          <div class="table-scroll mt-4">
            <table>
              <caption>Open payables by vendor</caption>
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Open</th>
                  <th scope="col">Bills</th>
                </tr>
              </thead>
              <tbody>
                {#each data.apAging.vendors as vendor (vendor.vendorId)}
                  <tr>
                    <td>{vendor.vendorName}</td>
                    <td>{money(vendor.totalCents)}</td>
                    <td>{vendor.bills.length}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No open payables.</p>
        {/if}
      {/if}
    </Card>
  </div>

  {#if data.statement}
    <Card class="mt-6">
      <div class="card-headline">
        <h2>Customer statement</h2>
        <Badge tone={(data.statement.aging.totalOpenCents ?? 0) > 0 ? "warn" : "good"}>{data.statement.customerName}</Badge>
      </div>
      <div class="statement-summary">
        <div><span>Date</span><strong>{data.statement.statementDate.slice(0, 10)}</strong></div>
        <div><span>Open</span><strong>{money(data.statement.aging.totalOpenCents)}</strong></div>
        <div><span>Invoices</span><strong>{data.statement.invoices.length}</strong></div>
        <div><span>Payments</span><strong>{data.statement.payments.length}</strong></div>
      </div>
      <div class="table-scroll mt-4">
        <table>
          <caption>Statement invoices</caption>
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Issued</th>
              <th scope="col">Total</th>
              <th scope="col">Paid</th>
              <th scope="col">Open</th>
            </tr>
          </thead>
          <tbody>
            {#each data.statement.invoices as invoice (invoice.id)}
              <tr>
                <td><code>{invoice.invoiceNumber}</code></td>
                <td>{invoice.issuedAt.slice(0, 10)}</td>
                <td>{money(invoice.totalCents)}</td>
                <td>{money(invoice.amountPaidCents)}</td>
                <td>{money(invoice.amountDueCents)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}

  {#if data.generalLedger}
    <Card class="mt-6">
      <div class="card-headline">
        <h2>General ledger</h2>
        <Badge tone="neutral">{data.generalLedger.account.code}</Badge>
      </div>
      <div class="statement-summary">
        <div><span>Opening</span><strong>{money(data.generalLedger.openingBalanceCents)}</strong></div>
        <div><span>Debits</span><strong>{money(data.generalLedger.totalDebitCents)}</strong></div>
        <div><span>Credits</span><strong>{money(data.generalLedger.totalCreditCents)}</strong></div>
        <div><span>Closing</span><strong>{money(data.generalLedger.closingBalanceCents)}</strong></div>
      </div>
      {#if data.generalLedger.entries.length > 0}
        <div class="table-scroll mt-4">
          <table>
            <caption>{data.generalLedger.account.name} ledger</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Entry</th>
                <th scope="col">Source</th>
                <th scope="col">Debit</th>
                <th scope="col">Credit</th>
                <th scope="col">Running</th>
              </tr>
            </thead>
            <tbody>
              {#each data.generalLedger.entries as entry (`${entry.entryId}-${entry.lineId}`)}
                <tr>
                  <td>{entry.entryDate}</td>
                  <td>{entry.description ?? entry.lineDescription ?? entry.entryId}</td>
                  <td>{entry.sourceRef ?? entry.sourceType ?? "-"}</td>
                  <td>{money(entry.debitCents)}</td>
                  <td>{money(entry.creditCents)}</td>
                  <td>{money(entry.runningBalanceCents)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No ledger entries for this account and date range.</p>
      {/if}
    </Card>
  {/if}
</main>

<style>
  .report-filter {
    display: grid;
    grid-template-columns: minmax(150px, 180px) minmax(150px, 180px) minmax(220px, 1fr) minmax(220px, 1fr) auto;
    align-items: end;
    gap: 12px;
  }
  .report-filter :global(.field) {
    margin-block-end: 0;
  }
  .report-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .statement-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .bucket-grid,
  .statement-summary {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  .statement-grid .statement-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .bucket-grid div,
  .statement-summary div,
  .statement-lines div {
    display: grid;
    gap: 6px;
    border: 1px solid var(--color-line);
    border-radius: 8px;
    padding: 10px;
    min-width: 0;
  }
  .bucket-grid span,
  .statement-summary span,
  .statement-lines span {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .bucket-grid strong,
  .statement-summary strong,
  .statement-lines strong {
    overflow-wrap: anywhere;
  }
  .statement-lines {
    display: grid;
    gap: 8px;
    margin-block-start: 12px;
  }
  .review-note {
    color: var(--color-ink-faint);
    font-size: 0.85rem;
    margin-block: 12px 0;
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 960px) {
    .report-grid,
    .statement-grid,
    .report-filter {
      grid-template-columns: 1fr;
    }
    .bucket-grid,
    .statement-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 560px) {
    .bucket-grid,
    .statement-summary {
      grid-template-columns: 1fr;
    }
  }
</style>
