<script>
  import { enhance } from "$app/forms";
  import { money } from "$lib/format";
  import { Alert, Badge, Button, Card, Field, MetricStrip, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const unmatched = $derived(data.transactions.filter((tx) => tx.matchStatus === "unmatched").length);
  const excluded = $derived(data.transactions.filter((tx) => tx.matchStatus === "excluded").length);
  const matchableTransactions = $derived(data.transactions.filter((tx) => tx.matchStatus === "unmatched" && !tx.reconciled));
  const statementDelta = $derived(data.transactions.reduce((total, tx) => total + tx.amountCents, 0));
  const latestImport = $derived(data.statementImports.at(-1));
  const inProgressReconciliations = $derived(data.reconciliations.filter((session) => session.status === "in_progress"));
  const displayedReconciliation = $derived(form?.reconciliation ?? data.reconciliation);
  const csvPreview = $derived(form?.csvPreview);
  const suggestionsByTransaction = $derived(
    new Map(data.matchSuggestions.map((group) => [group.transactionId, group.suggestions]))
  );
  const metrics = $derived([
    { label: "Bank accounts", value: data.accounts.length, tone: data.accounts.length > 0 ? "good" : "neutral", hint: "connected ledgers" },
    {
      label: "Imports",
      value: data.statementImports.length,
      tone: "info",
      hint: latestImport ? `${latestImport.importedRows} rows / ${latestImport.duplicateRows} duplicates` : "history"
    },
    { label: "Unmatched", value: unmatched, tone: unmatched > 0 ? "warn" : "good", hint: money(statementDelta) },
    { label: "Excluded transactions", value: excluded, tone: excluded > 0 ? "neutral" : "good", hint: "ignored in close" }
  ]);

  function transactionTone(status) {
    if (status === "unmatched") return "warn";
    if (status === "excluded") return "neutral";
    return "good";
  }

  function previewTone(status) {
    if (status === "duplicate") return "warn";
    if (status === "skipped") return "neutral";
    return "good";
  }
</script>

<svelte:head>
  <title>Banking · Accounting ERP</title>
</svelte:head>

<main class="section banking-page">
  <PageHeader
    eyebrow="Bank reconciliation"
    title="Banking"
    description="Statement import, matching, and reconciliation-session workflow from the StackSuite bank-reconciliation module."
  />

  {#if form?.accountCreated}
    <Alert tone="success">Bank account created.</Alert>
  {:else if form?.csvPreview}
    <Alert tone="info">Preview found {form.csvPreview.importableRows} importable rows, {form.csvPreview.duplicateRows} duplicates, and {form.csvPreview.skippedRows} skipped rows.</Alert>
  {:else if form?.csvImported}
    <Alert tone="success">Imported {form.importedCount} rows. Skipped {form.skippedDuplicateCount} duplicates.</Alert>
  {:else if form?.transactionMatched}
    <Alert tone="success">Statement transaction matched.</Alert>
  {:else if form?.transactionUnmatched}
    <Alert tone="success">Statement transaction unmatched. Removed {form.removedMatchCount} match records.</Alert>
  {:else if form?.transactionExcluded}
    <Alert tone="warn">Statement transaction excluded from reconciliation.</Alert>
  {:else if form?.transactionRestored}
    <Alert tone="success">Statement transaction restored for matching.</Alert>
  {:else if form?.reconciliationStarted}
    <Alert tone="success">Reconciliation started for {form.reconciliation.statementDate}.</Alert>
  {:else if form?.reconciliationCompleted}
    <Alert tone="success">Reconciliation completed for {form.reconciliation.statementDate}.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <MetricStrip {metrics} />

  <div class="grid mt-6">
    <Card title="Statement transactions">
      {#if data.transactions.length > 0}
        <ul class="list">
          {#each data.transactions as tx (tx.id)}
            <li class="list-item row-item">
              <div>
                <strong>{tx.description}</strong>
                <p>{tx.transactionDate} · {tx.transactionHash}</p>
                {#if tx.matchStatus === "unmatched" && suggestionsByTransaction.get(tx.id)?.length}
                  <div class="candidate-list">
                    {#each suggestionsByTransaction.get(tx.id) ?? [] as suggestion (suggestion.targetId)}
                      <form method="POST" action="?/matchTransaction" use:enhance>
                        <input type="hidden" name="transactionId" value={tx.id} />
                        <input type="hidden" name="targetType" value={suggestion.targetType} />
                        <input type="hidden" name="targetId" value={suggestion.targetId} />
                        <input type="hidden" name="targetRef" value={suggestion.targetRef ?? ""} />
                        <input type="hidden" name="targetDate" value={suggestion.targetDate ?? ""} />
                        <input type="hidden" name="targetAmountCents" value={suggestion.amountCents} />
                        <input type="hidden" name="description" value={suggestion.description ?? ""} />
                        <input type="hidden" name="confidence" value={suggestion.confidence} />
                        <span>{suggestion.targetRef ?? suggestion.targetId}</span>
                        <small>{suggestion.source ?? suggestion.targetType} · {suggestion.confidence}% · {suggestion.reasons.join(", ")}</small>
                        <Button type="submit" variant="ghost" size="sm">Match</Button>
                      </form>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="transaction-actions">
                <Badge tone={transactionTone(tx.matchStatus)}>{tx.matchStatus}</Badge>
                <Badge tone={tx.amountCents >= 0 ? "good" : "warn"}>{money(tx.amountCents)}</Badge>
                {#if data.canManage && !tx.reconciled}
                  {#if tx.matchStatus !== "unmatched" && tx.matchStatus !== "excluded"}
                    <form method="POST" action="?/unmatchTransaction" use:enhance>
                      <input type="hidden" name="transactionId" value={tx.id} />
                      <Button type="submit" variant="ghost" size="sm">Unmatch</Button>
                    </form>
                  {/if}
                  {#if tx.matchStatus !== "excluded"}
                    <form method="POST" action="?/excludeTransaction" use:enhance>
                      <input type="hidden" name="transactionId" value={tx.id} />
                      <input type="hidden" name="reason" value="Excluded from banking ledger." />
                      <Button type="submit" variant="ghost" size="sm">Exclude</Button>
                    </form>
                  {:else}
                    <form method="POST" action="?/restoreExcludedTransaction" use:enhance>
                      <input type="hidden" name="transactionId" value={tx.id} />
                      <Button type="submit" variant="ghost" size="sm">Restore</Button>
                    </form>
                  {/if}
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No imported statement transactions.</p>
      {/if}
    </Card>

    <Card title="Reconciliation">
      {#if displayedReconciliation}
        <dl class="stats">
          <div><dt>Status</dt><dd><Badge tone={displayedReconciliation.status === "completed" ? "good" : "warn"}>{displayedReconciliation.status}</Badge></dd></div>
          <div><dt>Statement date</dt><dd>{displayedReconciliation.statementDate}</dd></div>
          <div><dt>Statement balance</dt><dd>{money(displayedReconciliation.statementBalanceCents)}</dd></div>
          <div><dt>Difference</dt><dd>{money(displayedReconciliation.differenceCents ?? 0)}</dd></div>
          <div><dt>Module status</dt><dd>{data.status.status}</dd></div>
        </dl>
      {:else}
        <p class="empty">No reconciliation session.</p>
      {/if}
      {#if data.reconciliations.length > 0}
        <div class="session-list">
          {#each data.reconciliations.slice(0, 4) (session.id)}
            <div>
              <a href={`/app/banking/reconciliations/${session.id}`}>{session.statementDate}</a>
              <strong>{money(session.statementBalanceCents)}</strong>
              <Badge tone={session.status === "completed" ? "good" : "warn"}>{session.status}</Badge>
            </div>
          {/each}
        </div>
      {/if}
    </Card>

    <Card title="Import history">
      {#if data.statementImports.length > 0}
        <ul class="list">
          {#each data.statementImports as statementImport (statementImport.id)}
            <li class="list-item row-item">
              <div>
                <strong><a href={`/app/banking/imports/${statementImport.id}`}>{statementImport.fileName ?? statementImport.source}</a></strong>
                <p>{statementImport.importedAt ?? statementImport.createdAt} · {statementImport.totalRows} rows</p>
              </div>
              <Badge tone={statementImport.status === "completed" ? "good" : "warn"}>
                {statementImport.importedRows}/{statementImport.duplicateRows}
              </Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No statement import history.</p>
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="operator-grid mt-6">
      <Card title="Create bank account">
        <form method="POST" action="?/createAccount" use:enhance>
          <div class="form-row">
            <Field label="Account name" id="bank-account-name">
              <input id="bank-account-name" name="name" required placeholder="Operating checking" value={form?.values?.name ?? ""} />
            </Field>
            <Field label="Bank name" id="bank-name">
              <input id="bank-name" name="bankName" placeholder="Demo Bank" value={form?.values?.bankName ?? ""} />
            </Field>
          </div>
          <div class="form-row">
            <Field label="Currency" id="bank-currency">
              <input id="bank-currency" name="currency" maxlength="3" value={form?.values?.currency ?? "USD"} />
            </Field>
            <Field label="Opening balance" id="bank-opening-balance">
              <input id="bank-opening-balance" name="openingBalance" type="number" step="0.01" value={form?.values?.openingBalance ?? "0"} />
            </Field>
          </div>
          <Button type="submit" variant="primary">Create account</Button>
        </form>
      </Card>

      <Card title="Import CSV statement">
        <form method="POST" action="?/importCsv" use:enhance>
          <Field label="Account" id="import-account">
            <select id="import-account" name="bankAccountId" required disabled={data.accounts.length === 0}>
              <option value="">Choose account</option>
              {#each data.accounts as account (account.id)}
                <option value={account.id}>{account.name}</option>
              {/each}
            </select>
          </Field>
          <Field label="File name" id="import-file-name">
            <input id="import-file-name" name="fileName" placeholder="operating.csv" value={form?.values?.fileName ?? "operating.csv"} />
          </Field>
          <Field label="Mapping preset" id="import-mapping-preset">
            <select id="import-mapping-preset" name="mappingPresetId">
              <option value="auto" selected={!form?.values?.mappingPresetId || form?.values?.mappingPresetId === "auto"}>Auto-detect columns</option>
              {#each data.mappingPresets as preset (preset.id)}
                <option value={preset.id} selected={form?.values?.mappingPresetId === preset.id}>{preset.label}</option>
              {/each}
              <option value="custom" selected={form?.values?.mappingPresetId === "custom"}>Custom fields</option>
            </select>
          </Field>
          <div class="mapping-row">
            <Field label="Date field" id="import-date-field">
              <input id="import-date-field" name="dateField" value={form?.values?.dateField ?? "Date"} />
            </Field>
            <Field label="Description field" id="import-description-field">
              <input id="import-description-field" name="descriptionField" value={form?.values?.descriptionField ?? "Description"} />
            </Field>
            <Field label="Amount field" id="import-amount-field">
              <input id="import-amount-field" name="amountField" value={form?.values?.amountField ?? "Amount"} />
            </Field>
          </div>
          <div class="mapping-row">
            <Field label="Debit field" id="import-debit-field">
              <input id="import-debit-field" name="debitField" placeholder="Debit" value={form?.values?.debitField ?? ""} />
            </Field>
            <Field label="Credit field" id="import-credit-field">
              <input id="import-credit-field" name="creditField" placeholder="Credit" value={form?.values?.creditField ?? ""} />
            </Field>
          </div>
          <Field label="CSV content" id="import-csv-content">
            <textarea id="import-csv-content" name="csvContent" rows="5">{form?.values?.csvContent ?? "Date,Description,Amount\n2026-06-20,Stripe payout,840.00\n2026-06-21,Cloud hosting,-125.50"}</textarea>
          </Field>
          {#if csvPreview}
            <div class="csv-preview">
              <div class="preview-summary">
                <span><strong>{csvPreview.importableRows}</strong> importable</span>
                <span><strong>{csvPreview.duplicateRows}</strong> duplicates</span>
                <span><strong>{csvPreview.skippedRows}</strong> skipped</span>
              </div>
              <div class="preview-mapping">
                Mapping: {csvPreview.fieldMapping.autoDetected ? "auto-detected" : csvPreview.fieldMapping.presetId ?? "custom"} · {csvPreview.totalRows} rows
              </div>
              {#if csvPreview.rows.length > 0}
                <div class="preview-table">
                  {#each csvPreview.rows as row (row.rowNumber)}
                    <div>
                      <span>#{row.rowNumber}</span>
                      <Badge tone={previewTone(row.status)}>{row.status}</Badge>
                      <span>{row.transactionDate ?? "-"}</span>
                      <span>{row.description ?? row.errorMessage ?? "-"}</span>
                      <span>{row.amountCents == null ? "-" : money(row.amountCents)}</span>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if csvPreview.truncated}
                <p class="empty">Showing the first {csvPreview.previewLimit} preview rows.</p>
              {/if}
            </div>
          {/if}
          <div class="button-row">
            <Button type="submit" formaction="?/previewCsv" variant="ghost" disabled={data.accounts.length === 0}>Preview import</Button>
            <Button type="submit" formaction="?/importCsv" variant="primary" disabled={data.accounts.length === 0}>Import statement</Button>
          </div>
        </form>
      </Card>

      <Card title="Match transaction">
        <form method="POST" action="?/matchTransaction" use:enhance>
          <Field label="Transaction" id="match-transaction">
            <select id="match-transaction" name="transactionId" required disabled={matchableTransactions.length === 0}>
              <option value="">Choose transaction</option>
              {#each matchableTransactions as tx (tx.id)}
                <option value={tx.id}>{tx.transactionDate} - {tx.description} - {money(tx.amountCents)}</option>
              {/each}
            </select>
          </Field>
          <Field label="Ledger reference" id="match-ledger-reference">
            <input id="match-ledger-reference" name="ledgerReferenceId" required placeholder="journal_line_1001" value={form?.values?.ledgerReferenceId ?? ""} />
          </Field>
          <Button type="submit" variant="primary" disabled={matchableTransactions.length === 0}>Match transaction</Button>
        </form>
      </Card>

      <Card title="Start reconciliation">
        <form method="POST" action="?/startReconciliation" use:enhance>
          <Field label="Account" id="reconcile-account">
            <select id="reconcile-account" name="bankAccountId" required disabled={data.accounts.length === 0}>
              <option value="">Choose account</option>
              {#each data.accounts as account (account.id)}
                <option value={account.id}>{account.name}</option>
              {/each}
            </select>
          </Field>
          <div class="form-row">
            <Field label="Statement date" id="reconcile-date">
              <input id="reconcile-date" name="statementDate" type="date" value={form?.values?.statementDate ?? "2026-06-30"} />
            </Field>
            <Field label="Statement balance" id="reconcile-balance">
              <input id="reconcile-balance" name="statementBalance" type="number" step="0.01" value={form?.values?.statementBalance ?? "0"} />
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={data.accounts.length === 0}>Start reconciliation</Button>
        </form>
      </Card>

      <Card title="Complete reconciliation">
        <form method="POST" action="?/completeReconciliation" use:enhance>
          <Field label="Session" id="complete-reconciliation">
            <select id="complete-reconciliation" name="reconciliationId" required disabled={inProgressReconciliations.length === 0}>
              <option value="">Choose session</option>
              {#each inProgressReconciliations as session (session.id)}
                <option value={session.id}>{session.statementDate} - {money(session.statementBalanceCents)}</option>
              {/each}
            </select>
          </Field>
          <Button type="submit" variant="primary" disabled={inProgressReconciliations.length === 0}>Complete reconciliation</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.8fr);
    gap: 16px;
  }
  .stats {
    display: grid;
    gap: 10px;
    margin: 0;
  }
  .stats div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-block-end: 1px solid var(--color-line);
    padding-block-end: 10px;
  }
  .stats dt {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .stats dd {
    margin: 0;
  }
  .session-list {
    display: grid;
    gap: 10px;
    margin-block-start: 16px;
    border-block-start: 1px solid var(--color-line);
    padding-block-start: 14px;
  }
  .session-list div {
    display: grid;
    grid-template-columns: minmax(92px, 1fr) minmax(96px, 1fr) auto;
    align-items: center;
    gap: 10px;
    font-size: 0.86rem;
  }
  .session-list a {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  .candidate-list {
    display: grid;
    gap: 8px;
    margin-block-start: 10px;
  }
  .candidate-list form {
    display: grid;
    grid-template-columns: minmax(120px, 0.8fr) minmax(180px, 1fr) auto;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--color-line);
    border-radius: 6px;
    padding: 8px;
  }
  .transaction-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    min-inline-size: 180px;
  }
  .transaction-actions form {
    margin: 0;
  }
  .candidate-list span {
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .candidate-list small {
    color: var(--color-ink-faint);
    font-size: 0.76rem;
  }
  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .csv-preview {
    display: grid;
    gap: 10px;
    border: 1px solid var(--color-line);
    border-radius: 6px;
    padding: 12px;
  }
  .preview-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .preview-summary span {
    color: var(--color-ink-faint);
    font-size: 0.82rem;
  }
  .preview-summary strong {
    color: var(--color-ink);
    font-family: var(--font-mono);
  }
  .preview-mapping {
    color: var(--color-ink-faint);
    font-size: 0.78rem;
  }
  .preview-table {
    display: grid;
    gap: 6px;
  }
  .preview-table div {
    display: grid;
    grid-template-columns: 44px 92px minmax(92px, 0.8fr) minmax(140px, 1fr) minmax(82px, auto);
    align-items: center;
    gap: 8px;
    border-block-start: 1px solid var(--color-line);
    padding-block-start: 6px;
    font-size: 0.8rem;
  }
  .preview-table span:first-child,
  .preview-table span:nth-child(3),
  .preview-table span:last-child {
    font-family: var(--font-mono);
  }
  .operator-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .operator-grid form {
    display: grid;
    gap: 12px;
  }
  .form-row,
  .mapping-row {
    display: grid;
    gap: 12px;
  }
  .form-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mapping-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .empty,
  p {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 860px) {
    .grid,
    .operator-grid,
    .candidate-list form,
    .preview-summary,
    .preview-table div,
    .form-row,
    .mapping-row {
      grid-template-columns: 1fr;
    }
  }
</style>
