<script>
  import { enhance } from "$app/forms";
  import { Alert, Badge, Button, Card, Field, PageHeader } from "$lib/ui";

  let { data, form } = $props();
  const vendor = $derived(data.vendor);
</script>

<svelte:head>
  <title>{vendor.name} · Vendors · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="AP vendor" title={vendor.name}>
    {#snippet actions()}
      <Button href="/app/payables" variant="ghost">Payables</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={vendor.tone}>{vendor.active ? "active" : "inactive"}</Badge>
      <span>{vendor.currency}</span>
      {#if vendor.is1099Vendor}<Badge tone="warn">1099</Badge>{/if}
    {/snippet}
  </PageHeader>

  {#if form?.vendorUpdated}
    <Alert tone="success">Vendor updated.</Alert>
  {:else if form?.vendorStatusUpdated}
    <Alert tone="success">Vendor status updated.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="grid">
    <div class="grid__main">
      <Card title="Vendor profile">
        <dl class="detail-list">
          <div><dt>Email</dt><dd>{vendor.email ?? "-"}</dd></div>
          <div><dt>Phone</dt><dd>{vendor.phone ?? "-"}</dd></div>
          <div><dt>Address</dt><dd>{vendor.addressLines.length ? vendor.addressLines.join(", ") : "-"}</dd></div>
          <div><dt>Default terms</dt><dd>{vendor.termsLabel}</dd></div>
          <div><dt>Default expense</dt><dd>{vendor.defaultExpenseAccountLabel}</dd></div>
          <div><dt>External source</dt><dd>{vendor.externalSource ?? "-"}</dd></div>
          <div><dt>External ID</dt><dd>{vendor.externalId ?? "-"}</dd></div>
          <div><dt>Created</dt><dd>{vendor.created}</dd></div>
          <div><dt>Updated</dt><dd>{vendor.updated}</dd></div>
        </dl>
      </Card>

      <Card title="Bills">
        {#if data.bills.length > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Date</th>
                  <th>Due date</th>
                  <th>Total</th>
                  <th>Open</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each data.bills as bill (bill.id)}
                  <tr>
                    <td><a href={`/app/payables/${bill.id}`}><code>{bill.billNumber}</code></a></td>
                    <td>{bill.billDateShort}</td>
                    <td>{bill.dueDateShort}</td>
                    <td>{bill.total}</td>
                    <td>{bill.due}</td>
                    <td><Badge tone={bill.tone}>{bill.status}</Badge></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No bills have been recorded for this vendor.</p>
        {/if}
      </Card>

      <Card title="Payment history">
        {#if data.payments.length > 0}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Applications</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each data.payments as payment (payment.id)}
                  <tr>
                    <td>{payment.paymentDateShort}</td>
                    <td>{payment.paymentNumber}</td>
                    <td>{payment.amount}</td>
                    <td>{payment.paymentMethod ?? "-"}</td>
                    <td>{payment.referenceNumber ?? "-"}</td>
                    <td>{payment.appliedCount}</td>
                    <td><Badge tone={payment.tone}>{payment.status}</Badge></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="empty">No payments have been recorded for this vendor.</p>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Aging">
        <dl class="detail-list compact">
          <div><dt>Current</dt><dd class="num">{data.aging.current}</dd></div>
          <div><dt>1-30</dt><dd class="num">{data.aging.days1To30}</dd></div>
          <div><dt>31-60</dt><dd class="num">{data.aging.days31To60}</dd></div>
          <div><dt>61-90</dt><dd class="num">{data.aging.days61To90}</dd></div>
          <div><dt>90+</dt><dd class="num">{data.aging.days90Plus}</dd></div>
          <div><dt>Total open</dt><dd class="num strong">{data.aging.total}</dd></div>
        </dl>
      </Card>

      <Card title="1099 readiness">
        <dl class="detail-list compact">
          <div><dt>Status</dt><dd><Badge tone={data.taxSummary.tone}>{data.taxSummary.label}</Badge></dd></div>
          <div><dt>Tax ID</dt><dd>{vendor.taxIdStatus}</dd></div>
          <div><dt>{data.taxSummary.year} paid</dt><dd class="num">{data.taxSummary.paidThisYear}</dd></div>
          <div><dt>Payments</dt><dd>{data.taxSummary.paymentCount}</dd></div>
        </dl>
      </Card>

      <Card title="Recurring bills">
        {#if data.recurringBillTemplates.length > 0}
          <div class="stack">
            {#each data.recurringBillTemplates as template (template.id)}
              <a class="linked-row" href={`/app/payables/recurring/${template.id}`}>
                <span>{template.name}</span>
                <span>{template.nextBillDateShort}</span>
                <Badge tone={template.tone}>{template.status}</Badge>
              </a>
            {/each}
          </div>
        {:else}
          <p class="empty">No recurring bill schedules for this vendor.</p>
        {/if}
      </Card>

      {#if vendor.notes}
        <Card title="Notes">
          <p class="empty">{vendor.notes}</p>
        </Card>
      {/if}

      {#if data.canManage}
        <Card title="Vendor master">
          <form method="POST" action="?/updateVendor" use:enhance>
            <Field label="Name" id="vendor-edit-name"><input id="vendor-edit-name" name="name" required value={form?.values?.name ?? vendor.name} /></Field>
            <Field label="Email" id="vendor-edit-email"><input id="vendor-edit-email" name="email" type="email" value={form?.values?.email ?? vendor.email ?? ""} /></Field>
            <Field label="Phone" id="vendor-edit-phone"><input id="vendor-edit-phone" name="phone" value={form?.values?.phone ?? vendor.phone ?? ""} /></Field>
            <div class="form-row">
              <Field label="Currency" id="vendor-edit-currency"><input id="vendor-edit-currency" name="currency" maxlength="3" value={form?.values?.currency ?? vendor.currency} /></Field>
              <Field label="Terms days" id="vendor-edit-terms"><input id="vendor-edit-terms" name="defaultPaymentTermsDays" type="number" min="0" max="365" value={form?.values?.defaultPaymentTermsDays ?? vendor.defaultPaymentTermsDays} /></Field>
            </div>
            <Field label="Address" id="vendor-edit-address"><input id="vendor-edit-address" name="addressLine1" value={form?.values?.addressLine1 ?? vendor.addressLine1 ?? ""} /></Field>
            <div class="form-row">
              <Field label="City" id="vendor-edit-city"><input id="vendor-edit-city" name="city" value={form?.values?.city ?? vendor.city ?? ""} /></Field>
              <Field label="State" id="vendor-edit-state"><input id="vendor-edit-state" name="state" value={form?.values?.state ?? vendor.state ?? ""} /></Field>
            </div>
            <div class="form-row">
              <Field label="Postal" id="vendor-edit-postal"><input id="vendor-edit-postal" name="postalCode" value={form?.values?.postalCode ?? vendor.postalCode ?? ""} /></Field>
              <Field label="Country" id="vendor-edit-country"><input id="vendor-edit-country" name="country" value={form?.values?.country ?? vendor.country ?? ""} /></Field>
            </div>
            <div class="form-row">
              <Field label="Tax ID" id="vendor-edit-tax-id"><input id="vendor-edit-tax-id" name="taxId" value={form?.values?.taxId ?? vendor.taxId ?? ""} /></Field>
              <label class="check-row"><input type="checkbox" name="is1099Vendor" value="true" checked={form?.values?.is1099Vendor ?? vendor.is1099Vendor} /> 1099 vendor</label>
            </div>
            <Field label="Default expense" id="vendor-edit-expense-account">
              <select id="vendor-edit-expense-account" name="defaultExpenseAccountId">
                <option value="">None</option>
                {#each data.expenseAccounts as account (account.id)}
                  <option value={account.id} selected={(form?.values?.defaultExpenseAccountId ?? vendor.defaultExpenseAccountId ?? "") === account.id}>{account.code} · {account.name}</option>
                {/each}
              </select>
            </Field>
            <Field label="Notes" id="vendor-edit-notes"><textarea id="vendor-edit-notes" name="notes" rows="3">{form?.values?.notes ?? vendor.notes ?? ""}</textarea></Field>
            <Button type="submit" variant="primary">Update vendor</Button>
          </form>

          <form class="status-form" method="POST" action="?/updateVendorStatus" use:enhance>
            <input type="hidden" name="active" value={vendor.active ? "false" : "true"} />
            <Button type="submit" variant="ghost">{vendor.active ? "Deactivate vendor" : "Reactivate vendor"}</Button>
          </form>
        </Card>
      {/if}
    </div>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
    margin-block-start: 4px;
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.85fr);
    align-items: start;
  }
  .grid__main,
  .grid__side,
  .stack {
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
  .compact {
    grid-template-columns: 1fr;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .strong {
    font-weight: 600;
    color: var(--color-ink);
  }
  .linked-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    border-block-end: 1px solid var(--color-line);
    color: inherit;
    padding-block: 10px;
    text-decoration: none;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .check-row {
    display: flex;
    gap: 8px;
    align-items: center;
    min-height: 42px;
    color: var(--color-ink);
    font-size: 0.9rem;
  }
  .status-form {
    margin-block-start: 14px;
  }
  .empty {
    margin: 0;
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
