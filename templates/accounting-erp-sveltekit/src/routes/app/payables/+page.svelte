<script>
  import { enhance } from "$app/forms";
  import { money, relativeTime } from "$lib/format";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const openBills = $derived(data.bills.filter((bill) => bill.amountDueCents > 0 && bill.status !== "void"));
  const openAmount = $derived(openBills.reduce((total, bill) => total + bill.amountDueCents, 0));
  const overdueAmount = $derived((data.aging?.days1To30Cents ?? 0) + (data.aging?.days31To60Cents ?? 0) + (data.aging?.days61To90Cents ?? 0) + (data.aging?.days90PlusCents ?? 0));
  const activeRecurringBills = $derived(data.recurringBillTemplates.filter((template) => template.status === "active"));
  const expenseAccounts = $derived(data.accounts.filter((account) => account.type === "expense" && !account.isHeader));
  const liabilityAccounts = $derived(data.accounts.filter((account) => account.type === "liability" && !account.isHeader));
  const paymentAccounts = $derived(data.accounts.filter((account) => account.type === "asset" && !account.isHeader));
  const metrics = $derived([
    { label: "Open bills", value: openBills.length, tone: openBills.length > 0 ? "warn" : "good", hint: money(openAmount) },
    { label: "Overdue", value: money(overdueAmount), tone: overdueAmount > 0 ? "bad" : "good", hint: "aging buckets" },
    { label: "Vendors", value: data.vendors.length, tone: "neutral", hint: "payables master data" },
    { label: "Recurring", value: activeRecurringBills.length, tone: activeRecurringBills.length > 0 ? "good" : "neutral", hint: "active schedules" }
  ]);

  function billTone(status) {
    if (status === "paid") return "good";
    if (status === "void") return "bad";
    if (status === "pending_approval" || status === "payable" || status === "partial") return "warn";
    return "neutral";
  }

  function recurringTone(status) {
    if (status === "active") return "good";
    if (status === "paused") return "warn";
    if (status === "cancelled") return "bad";
    return "neutral";
  }
</script>

<svelte:head>
  <title>Payables · Accounting ERP</title>
</svelte:head>

<main class="section payables-page">
  <PageHeader
    eyebrow="Accounts payable"
    title="Payables"
    description="Vendors, bills, and aging from the StackSuite accounts-payable module."
  >
    {#snippet actions()}
      <Button href="/app/ledger" variant="ghost">Ledger</Button>
    {/snippet}
  </PageHeader>

  {#if form?.vendorCreated}
    <Alert tone="success">Vendor created.</Alert>
  {:else if form?.billCreated}
    <Alert tone="success">Bill created.</Alert>
  {:else if form?.recurringBillTemplateCreated}
    <Alert tone="success">Recurring bill schedule created.</Alert>
  {:else if form?.recurringBillStatusUpdated}
    <Alert tone="success">Recurring bill schedule updated.</Alert>
  {:else if form?.recurringBillsGenerated}
    <Alert tone="success">{form.generatedBillCount} recurring bill{form.generatedBillCount === 1 ? "" : "s"} generated.</Alert>
  {:else if form?.billMarkedPayable}
    <Alert tone="success">Bill marked payable and posted to the ledger.</Alert>
  {:else if form?.billPaymentRecorded}
    <Alert tone="success">Bill payment recorded and posted to the ledger.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="content-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Bills</h2>
        <Badge tone={openBills.length > 0 ? "warn" : "good"}>{openBills.length} open</Badge>
      </div>
      {#if data.bills.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Vendor bills</caption>
            <thead>
              <tr>
                <th scope="col">Bill</th>
                <th scope="col">Vendor</th>
                <th scope="col">Total</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                {#if data.canManage}<th scope="col">Action</th>{/if}
              </tr>
            </thead>
            <tbody>
              {#each data.bills as bill (bill.id)}
                <tr>
                  <td><code>{bill.billNumber}</code></td>
                  <td>{data.vendors.find((vendor) => vendor.id === bill.vendorId)?.name ?? bill.vendorId}</td>
                  <td>{money(bill.totalCents, bill.currency)}</td>
                  <td>{money(bill.amountDueCents, bill.currency)}</td>
                  <td><Badge tone={billTone(bill.status)}>{bill.status}</Badge></td>
                  <td>{relativeTime(bill.createdAt)}</td>
                  {#if data.canManage}
                    <td>
                      {#if bill.status === "draft" || bill.status === "pending_approval"}
                        <form class="inline-form" method="POST" action="?/markPayable" use:enhance>
                          <input type="hidden" name="billId" value={bill.id} />
                          <select name="apAccountId" aria-label="AP account" required>
                            <option value="">AP account</option>
                            {#each liabilityAccounts as account (account.id)}
                              <option value={account.id} selected={bill.apAccountId === account.id}>{account.code} · {account.name}</option>
                            {/each}
                          </select>
                          <Button type="submit" variant="ghost">Post</Button>
                        </form>
                      {:else if bill.status === "payable" || bill.status === "partial"}
                        <form class="inline-form" method="POST" action="?/recordPayment" use:enhance>
                          <input type="hidden" name="billId" value={bill.id} />
                          <input type="hidden" name="paymentDate" value={data.today} />
                          <select name="paymentAccountId" aria-label="Payment account" required>
                            <option value="">Pay from</option>
                            {#each paymentAccounts as account (account.id)}
                              <option value={account.id}>{account.code} · {account.name}</option>
                            {/each}
                          </select>
                          <Button type="submit" variant="ghost">Pay</Button>
                        </form>
                      {/if}
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No bills have been recorded yet.</p>
      {/if}
    </Card>
    <Card>
      <div class="card-headline">
        <h2>Recurring bills</h2>
        <Badge tone={activeRecurringBills.length > 0 ? "good" : "neutral"}>{activeRecurringBills.length} active</Badge>
      </div>

      {#if data.canManage}
        <form class="generate-form" method="POST" action="?/generateDueRecurringBills" use:enhance>
          <Field label="As of" id="recurring-generate-as-of"><input id="recurring-generate-as-of" name="asOfDate" type="date" value={form?.values?.asOfDate ?? data.today} /></Field>
          <Field label="Limit" id="recurring-generate-limit"><input id="recurring-generate-limit" name="limit" type="number" min="1" max="100" value={form?.values?.limit ?? "25"} /></Field>
          <Button type="submit" variant="ghost">Generate due</Button>
        </form>
      {/if}

      {#if data.recurringBillTemplates.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Recurring bill schedules</caption>
            <thead>
              <tr>
                <th scope="col">Schedule</th>
                <th scope="col">Vendor</th>
                <th scope="col">Next bill</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">Generated</th>
                {#if data.canManage}<th scope="col">Action</th>{/if}
              </tr>
            </thead>
            <tbody>
              {#each data.recurringBillTemplates as template (template.id)}
                <tr>
                  <td>{template.name}</td>
                  <td>{data.vendors.find((vendor) => vendor.id === template.vendorId)?.name ?? template.vendorId}</td>
                  <td>{template.nextBillDate.slice(0, 10)}</td>
                  <td>{money(template.totalCents, template.currency)}</td>
                  <td><Badge tone={recurringTone(template.status)}>{template.status}</Badge></td>
                  <td>{template.billsGenerated}</td>
                  {#if data.canManage}
                    <td>
                      <div class="inline-actions">
                        {#if template.status === "active"}
                          <form method="POST" action="?/updateRecurringBillStatus" use:enhance>
                            <input type="hidden" name="templateId" value={template.id} />
                            <input type="hidden" name="status" value="paused" />
                            <Button type="submit" variant="ghost">Pause</Button>
                          </form>
                        {:else if template.status === "paused"}
                          <form method="POST" action="?/updateRecurringBillStatus" use:enhance>
                            <input type="hidden" name="templateId" value={template.id} />
                            <input type="hidden" name="status" value="active" />
                            <Button type="submit" variant="ghost">Resume</Button>
                          </form>
                        {/if}
                        {#if template.status === "active" || template.status === "paused"}
                          <form method="POST" action="?/updateRecurringBillStatus" use:enhance>
                            <input type="hidden" name="templateId" value={template.id} />
                            <input type="hidden" name="status" value="cancelled" />
                            <Button type="submit" variant="ghost">Cancel</Button>
                          </form>
                        {/if}
                      </div>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No recurring bill schedules yet.</p>
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="form-grid mt-6">
      <Card title="Create vendor">
        <form method="POST" action="?/createVendor" use:enhance>
          <Field label="Name" id="vendor-name"><input id="vendor-name" name="name" required placeholder="Northwind Supplies" value={form?.values?.name ?? ""} /></Field>
          <Field label="Email" id="vendor-email"><input id="vendor-email" name="email" type="email" placeholder="ap@vendor.example" value={form?.values?.email ?? ""} /></Field>
          <Field label="Currency" id="vendor-currency"><input id="vendor-currency" name="currency" maxlength="3" value={form?.values?.currency ?? "USD"} /></Field>
          <Button type="submit" variant="primary">Create vendor</Button>
        </form>
      </Card>

      <Card title="Create bill">
        <form method="POST" action="?/createBill" use:enhance>
          <Field label="Vendor" id="bill-vendor">
            <select id="bill-vendor" name="vendorId" required>
              <option value="">Choose vendor</option>
              {#each data.vendors as vendor (vendor.id)}
                <option value={vendor.id}>{vendor.name}</option>
              {/each}
            </select>
          </Field>
          <div class="form-row">
            <Field label="Bill number" id="bill-number"><input id="bill-number" name="billNumber" placeholder="B-1001" value={form?.values?.billNumber ?? ""} /></Field>
            <Field label="Currency" id="bill-currency"><input id="bill-currency" name="currency" maxlength="3" value={form?.values?.currency ?? "USD"} /></Field>
          </div>
          <div class="form-row">
            <Field label="Bill date" id="bill-date"><input id="bill-date" name="billDate" type="date" required value={form?.values?.billDate ?? ""} /></Field>
            <Field label="Due date" id="bill-due"><input id="bill-due" name="dueDate" type="date" required value={form?.values?.dueDate ?? ""} /></Field>
          </div>
          <Field label="Line description" id="bill-description"><input id="bill-description" name="description" required placeholder="Software subscription" value={form?.values?.description ?? ""} /></Field>
          <div class="form-row">
            <Field label="Quantity" id="bill-quantity"><input id="bill-quantity" name="quantity" type="number" min="1" value={form?.values?.quantity ?? "1"} /></Field>
            <Field label="Unit amount" id="bill-amount"><input id="bill-amount" name="unitAmount" type="number" min="0" step="0.01" value={form?.values?.unitAmount ?? "0"} /></Field>
          </div>
          <div class="form-row">
            <Field label="Expense account" id="bill-expense-account">
              <select id="bill-expense-account" name="expenseAccountId" required>
                <option value="">Choose account</option>
                {#each expenseAccounts as account (account.id)}
                  <option value={account.id}>{account.code} · {account.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="AP account" id="bill-ap-account">
              <select id="bill-ap-account" name="apAccountId" required>
                <option value="">Choose account</option>
                {#each liabilityAccounts as account (account.id)}
                  <option value={account.id}>{account.code} · {account.name}</option>
                {/each}
              </select>
            </Field>
          </div>
          <Field label="Memo" id="bill-memo"><textarea id="bill-memo" name="memo" rows="3">{form?.values?.memo ?? ""}</textarea></Field>
          <Button type="submit" variant="primary">Create bill</Button>
        </form>
      </Card>

      <Card title="Create recurring bill">
        <form method="POST" action="?/createRecurringBillTemplate" use:enhance>
          <Field label="Name" id="recurring-name"><input id="recurring-name" name="name" required placeholder="Monthly hosting" value={form?.values?.name ?? ""} /></Field>
          <Field label="Vendor" id="recurring-vendor">
            <select id="recurring-vendor" name="vendorId" required>
              <option value="">Choose vendor</option>
              {#each data.vendors as vendor (vendor.id)}
                <option value={vendor.id}>{vendor.name}</option>
              {/each}
            </select>
          </Field>
          <div class="form-row">
            <Field label="Frequency" id="recurring-frequency">
              <select id="recurring-frequency" name="frequency" required>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom days</option>
              </select>
            </Field>
            <Field label="Custom days" id="recurring-custom-days"><input id="recurring-custom-days" name="customDays" type="number" min="1" value={form?.values?.customDays ?? ""} /></Field>
          </div>
          <div class="form-row">
            <Field label="Start date" id="recurring-start"><input id="recurring-start" name="startDate" type="date" required value={form?.values?.startDate ?? data.today} /></Field>
            <Field label="Terms days" id="recurring-terms"><input id="recurring-terms" name="paymentTermsDays" type="number" min="1" max="365" value={form?.values?.paymentTermsDays ?? "30"} /></Field>
          </div>
          <Field label="Max occurrences" id="recurring-max"><input id="recurring-max" name="maxOccurrences" type="number" min="1" value={form?.values?.maxOccurrences ?? ""} /></Field>
          <Field label="Line description" id="recurring-description"><input id="recurring-description" name="description" required placeholder="Hosting" value={form?.values?.description ?? ""} /></Field>
          <div class="form-row">
            <Field label="Quantity" id="recurring-quantity"><input id="recurring-quantity" name="quantity" type="number" min="1" value={form?.values?.quantity ?? "1"} /></Field>
            <Field label="Unit amount" id="recurring-amount"><input id="recurring-amount" name="unitAmount" type="number" min="0" step="0.01" value={form?.values?.unitAmount ?? "0"} /></Field>
          </div>
          <div class="form-row">
            <Field label="Tax amount" id="recurring-tax"><input id="recurring-tax" name="taxAmount" type="number" min="0" step="0.01" value={form?.values?.taxAmount ?? "0"} /></Field>
            <Field label="Currency" id="recurring-currency"><input id="recurring-currency" name="currency" maxlength="3" value={form?.values?.currency ?? "USD"} /></Field>
          </div>
          <Field label="Expense account" id="recurring-expense-account">
            <select id="recurring-expense-account" name="expenseAccountId" required>
              <option value="">Choose account</option>
              {#each expenseAccounts as account (account.id)}
                <option value={account.id}>{account.code} · {account.name}</option>
              {/each}
            </select>
          </Field>
          <Field label="Memo" id="recurring-memo"><textarea id="recurring-memo" name="memo" rows="3">{form?.values?.memo ?? ""}</textarea></Field>
          <Button type="submit" variant="primary">Create schedule</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .payables-page :global(.card__body) {
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
    min-width: 720px;
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
  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .inline-form {
    display: grid;
    grid-template-columns: minmax(150px, 1fr) auto;
    gap: 8px;
    align-items: center;
  }
  .inline-form select {
    min-width: 0;
    max-width: 220px;
  }
  .inline-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .generate-form {
    display: grid;
    grid-template-columns: minmax(130px, 1fr) minmax(90px, 0.6fr) auto;
    gap: 10px;
    align-items: end;
    margin-block-end: 14px;
  }
  .form-grid {
    display: grid;
    grid-template-columns: minmax(240px, 0.7fr) minmax(320px, 1.15fr) minmax(320px, 1.15fr);
    gap: 16px;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 980px) {
    .form-grid,
    .form-row,
    .generate-form {
      grid-template-columns: 1fr;
    }
  }
</style>
