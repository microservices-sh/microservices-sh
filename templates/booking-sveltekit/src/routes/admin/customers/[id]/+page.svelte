<script lang="ts">
  import { Badge, Button, Card, Eyebrow, Field } from "$lib/ui";

  let { data, form } = $props();

  const snapshot = $derived(data.membershipSnapshot);
  const tiers = $derived(data.membershipTiers ?? []);
  const membership = $derived(snapshot?.membership ?? null);
  const tier = $derived(snapshot?.tier ?? null);
  const balance = $derived(snapshot?.creditBalance ?? null);
  const selectedTierId = $derived(membership?.tierId ?? tiers[0]?.id ?? "");

  function formatMoney(cents: number, currency = "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase()
    }).format(cents / 100);
  }

  function formatDate(value: string | null | undefined) {
    return value ? new Date(value).toLocaleDateString() : "Not set";
  }

  function membershipTone(status: string | undefined) {
    if (status === "active") return "good";
    if (status === "cancelled" || status === "expired") return "bad";
    return "warn";
  }

  function transactionTone(type: string) {
    return type === "credit" ? "good" : "warn";
  }
</script>

<main class="section">
  <div class="content-grid">
    <div class="stack">
      <section>
        <Eyebrow>Customer detail</Eyebrow>
        <h1>{data.customer.name}</h1>
        <p>{data.customer.email}</p>
        <p><Button href="/admin/customers" variant="ghost">Back to customers</Button></p>
      </section>

      {#if form?.error}
        <p class="status error">{form.error}</p>
      {:else if form?.success}
        <p class="status">{form.success}</p>
      {/if}

      <Card>
        <h2>Profile</h2>
        <dl class="detail-list">
          <div>
            <dt>Email</dt>
            <dd><a href={`mailto:${data.customer.email}`}>{data.customer.email}</a></dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{data.customer.phone || "Not captured"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(data.customer.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(data.customer.updatedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd><code>{data.customer.id}</code></dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2>Bookings</h2>
        {#if data.bookings.length === 0}
          <p>No bookings for this customer.</p>
        {:else}
          <ul class="list">
            {#each data.bookings as booking}
              <li class="list-item">
                <a href={`/admin/bookings/${booking.id}`}><strong>{booking.serviceName}</strong></a><br />
                {new Date(booking.startsAt).toLocaleString()}<br />
                <span>{booking.status}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
    </div>

    <div class="stack">
      <Card>
        <div class="card-heading">
          <div>
            <h2>Membership</h2>
            <p>Module status: {data.membershipCreditsStatus.status}</p>
          </div>
          {#if membership}
            <Badge tone={membershipTone(membership.status)}>{membership.status}</Badge>
          {:else}
            <Badge tone="neutral">none</Badge>
          {/if}
        </div>

        {#if membership}
          <dl class="detail-list compact">
            <div>
              <dt>Tier</dt>
              <dd>{tier?.name ?? membership.tierId}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{formatDate(membership.startedAt)}</dd>
            </div>
            <div>
              <dt>Renews</dt>
              <dd>{membership.autoRenew ? "Auto renew" : "Manual"}</dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{formatDate(membership.expiresAt)}</dd>
            </div>
          </dl>

          <form method="POST" action="?/changeMembershipTier" class="form-stack">
            <div class="field-grid">
              <Field label="Tier" id="change-tier">
                <select id="change-tier" name="tierId" required>
                  {#each tiers as option}
                    <option value={option.id} selected={option.id === selectedTierId}>{option.name}</option>
                  {/each}
                </select>
              </Field>
              <Field label="Reason" id="change-reason">
                <input id="change-reason" name="reason" placeholder="Upgrade, downgrade, renewal" />
              </Field>
            </div>
            <Button type="submit" variant="primary" disabled={tiers.length === 0}>Change tier</Button>
          </form>

          <form method="POST" action="?/cancelMembership" class="inline-form">
            <input name="reason" value="Cancelled from customer detail" type="hidden" />
            <Button type="submit" variant="ghost">Cancel membership</Button>
          </form>
        {:else}
          <p>No active membership is assigned.</p>
          <form method="POST" action="?/assignMembership" class="form-stack">
            <div class="field-grid">
              <Field label="Tier" id="assign-tier">
                <select id="assign-tier" name="tierId" required disabled={tiers.length === 0}>
                  {#each tiers as option}
                    <option value={option.id} selected={option.id === selectedTierId}>{option.name}</option>
                  {/each}
                </select>
              </Field>
              <Field label="Subscription" id="subscription-type">
                <select id="subscription-type" name="subscriptionType">
                  <option value="manual">Manual</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </Field>
              <Field label="Started" id="started-at">
                <input id="started-at" name="startedAt" type="date" />
              </Field>
              <Field label="Expires" id="expires-at">
                <input id="expires-at" name="expiresAt" type="date" />
              </Field>
            </div>
            <label class="check-row">
              <input name="autoRenew" type="checkbox" checked />
              <span>Auto renew</span>
            </label>
            <Field label="Reason" id="assign-reason">
              <input id="assign-reason" name="reason" placeholder="Manual assignment" />
            </Field>
            <Button type="submit" variant="primary" disabled={tiers.length === 0}>Assign membership</Button>
          </form>
        {/if}
      </Card>

      <Card>
        <h2>Credit balance</h2>
        <div class="stat-grid compact-stats">
          <div class="stat-card">
            <span>Available</span>
            <strong>{formatMoney(balance?.balanceCents ?? 0, balance?.currency ?? "usd")}</strong>
          </div>
          <div class="stat-card">
            <span>Granted</span>
            <strong>{formatMoney(balance?.totalCreditedCents ?? 0, balance?.currency ?? "usd")}</strong>
          </div>
          <div class="stat-card">
            <span>Used</span>
            <strong>{formatMoney(balance?.totalUsedCents ?? 0, balance?.currency ?? "usd")}</strong>
          </div>
        </div>

        <div class="credit-forms">
          <form method="POST" action="?/grantCustomerCredit" class="form-stack">
            <h3>Grant</h3>
            <Field label="Amount" id="grant-amount">
              <input id="grant-amount" name="amount" type="number" min="0.01" step="0.01" required />
            </Field>
            <Field label="Description" id="grant-description">
              <input id="grant-description" name="description" placeholder="Retention credit" required />
            </Field>
            <Button type="submit" variant="primary">Grant credit</Button>
          </form>

          <form method="POST" action="?/debitCustomerCredit" class="form-stack">
            <h3>Debit</h3>
            <Field label="Amount" id="debit-amount">
              <input id="debit-amount" name="amount" type="number" min="0.01" step="0.01" required />
            </Field>
            <Field label="Description" id="debit-description">
              <input id="debit-description" name="description" placeholder="Applied to booking" required />
            </Field>
            <Button type="submit" variant="ghost">Debit credit</Button>
          </form>
        </div>

        <h3>Recent ledger</h3>
        {#if snapshot?.recentCreditTransactions.length}
          <ul class="list ledger-list">
            {#each snapshot.recentCreditTransactions as transaction}
              <li class="list-item row-item">
                <div>
                  <strong>{transaction.description}</strong>
                  <p>{new Date(transaction.createdAt).toLocaleString()} - {transaction.source}</p>
                </div>
                <Badge tone={transactionTone(transaction.type)}>
                  {transaction.type === "credit" ? "+" : "-"}{formatMoney(transaction.amountCents, balance?.currency ?? "usd")}
                </Badge>
              </li>
            {/each}
          </ul>
        {:else}
          <p>No credit transactions yet.</p>
        {/if}
      </Card>

      <Card>
        <h2>Membership tiers</h2>
        {#if tiers.length}
          <ul class="list tier-list">
            {#each tiers as option}
              <li class="list-item row-item">
                <div>
                  <strong>{option.name}</strong>
                  <p>{formatMoney(option.priceMonthlyCents ?? 0, option.currency)} monthly - {option.discountBasisPoints / 100}% discount</p>
                </div>
                <Badge tone={option.status === "active" ? "good" : "neutral"}>{option.status}</Badge>
              </li>
            {/each}
          </ul>
        {:else}
          <p>Create a tier before assigning memberships.</p>
        {/if}

        <form method="POST" action="?/createTier" class="form-stack tier-form">
          <div class="field-grid">
            <Field label="Name" id="tier-name">
              <input id="tier-name" name="name" placeholder="Member Plus" required />
            </Field>
            <Field label="Slug" id="tier-slug">
              <input id="tier-slug" name="slug" placeholder="member-plus" />
            </Field>
            <Field label="Monthly price" id="tier-monthly">
              <input id="tier-monthly" name="priceMonthly" type="number" min="0" step="0.01" value="0" />
            </Field>
            <Field label="Level" id="tier-level">
              <input id="tier-level" name="level" type="number" min="0" step="1" value="1" />
            </Field>
            <Field label="Discount basis points" id="tier-discount">
              <input id="tier-discount" name="discountBasisPoints" type="number" min="0" max="10000" step="1" value="0" />
            </Field>
            <Field label="Position" id="tier-position">
              <input id="tier-position" name="position" type="number" min="0" step="1" value={tiers.length + 1} />
            </Field>
          </div>
          <Field label="Description" id="tier-description">
            <input id="tier-description" name="description" placeholder="Priority booking and account credits" />
          </Field>
          <Field label="Benefits" id="tier-benefits">
            <textarea id="tier-benefits" name="benefits" rows="3" placeholder="One benefit per line"></textarea>
          </Field>
          <label class="check-row">
            <input name="isDefault" type="checkbox" />
            <span>Default tier</span>
          </label>
          <Button type="submit" variant="primary">Create tier</Button>
        </form>
      </Card>
    </div>
  </div>
</main>

<style>
  .stack {
    display: grid;
    gap: 18px;
  }

  .card-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 14px;
  }

  .card-heading p {
    margin-block: 0.25rem 0;
  }

  .compact {
    margin-block-end: 16px;
  }

  .compact-stats {
    margin-block: 0 18px;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }

  .compact-stats .stat-card {
    padding: 16px;
  }

  .compact-stats .stat-card strong {
    font-size: clamp(1.35rem, 4vw, 1.8rem);
  }

  .form-stack {
    display: grid;
    gap: 12px;
    margin-block-start: 16px;
  }

  .inline-form {
    margin-block-start: 10px;
  }

  .check-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--color-ink);
  }

  .check-row input {
    min-block-size: auto;
    inline-size: auto;
  }

  .credit-forms {
    display: grid;
    gap: 18px;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    margin-block: 18px;
  }

  .ledger-list,
  .tier-list {
    margin-block-end: 18px;
  }

  .tier-form {
    border-block-start: 1px solid var(--color-line);
    padding-block-start: 18px;
  }
</style>
