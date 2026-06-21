<script lang="ts">
  import { Badge, Button, Card, Eyebrow, Field } from "$lib/ui";

  let { data, form } = $props();

  function formatMoney(cents: number, currency = "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase()
    }).format(cents / 100);
  }

  function membershipTone(status: string | undefined) {
    if (status === "active") return "good";
    if (status === "cancelled" || status === "expired") return "bad";
    return status ? "warn" : "neutral";
  }
</script>

<main class="section">
  <div class="content-grid">
    <div class="stack">
      <section>
        <Eyebrow>Admin</Eyebrow>
        <h1>Membership credits.</h1>
        <p>Manage booking memberships, customer credit balances, and tier setup from the embedded module.</p>
        <p><Button href="/admin" variant="ghost">Back to overview</Button></p>
      </section>

      {#if form?.error}
        <p class="status error">{form.error}</p>
      {:else if form?.success}
        <p class="status">{form.success}</p>
      {/if}

      <div class="stat-grid">
        <div class="stat-card">
          <span>Module</span>
          <strong>{data.status.status}</strong>
        </div>
        <div class="stat-card">
          <span>Tiers</span>
          <strong>{data.metrics.tiers}</strong>
        </div>
        <div class="stat-card">
          <span>Active</span>
          <strong>{data.metrics.activeMemberships}</strong>
        </div>
        <div class="stat-card">
          <span>Credit liability</span>
          <strong>{formatMoney(data.metrics.totalCreditCents)}</strong>
        </div>
      </div>

      <Card>
        <h2>Customer balances</h2>
        {#if data.customers.length === 0}
          <p>No customers yet.</p>
        {:else}
          <ul class="list">
            {#each data.customers as row}
              <li class="list-item row-item">
                <div>
                  <a href={`/admin/customers/${row.customer.id}`}><strong>{row.customer.name}</strong></a>
                  <p>
                    {row.customer.email} -
                    {row.snapshot?.tier?.name ?? "No membership"}
                  </p>
                </div>
                <div class="row-actions">
                  <Badge tone={membershipTone(row.snapshot?.membership?.status)}>
                    {row.snapshot?.membership?.status ?? "none"}
                  </Badge>
                  <strong>{formatMoney(row.snapshot?.creditBalance.balanceCents ?? 0, row.snapshot?.creditBalance.currency ?? "usd")}</strong>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
    </div>

    <div class="stack">
      <Card>
        <h2>Membership tiers</h2>
        {#if data.tiers.length === 0}
          <p>No tiers configured.</p>
        {:else}
          <ul class="list">
            {#each data.tiers as tier}
              <li class="list-item row-item">
                <div>
                  <strong>{tier.name}</strong>
                  <p>{tier.slug} - {formatMoney(tier.priceMonthlyCents ?? 0, tier.currency)} monthly</p>
                </div>
                <Badge tone={tier.status === "active" ? "good" : "neutral"}>{tier.status}</Badge>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>

      <Card>
        <h2>Create tier</h2>
        <form method="POST" action="?/createTier" class="form-stack">
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
            <Field label="Yearly price" id="tier-yearly">
              <input id="tier-yearly" name="priceYearly" type="number" min="0" step="0.01" />
            </Field>
            <Field label="Level" id="tier-level">
              <input id="tier-level" name="level" type="number" min="0" step="1" value="1" />
            </Field>
            <Field label="Discount basis points" id="tier-discount">
              <input id="tier-discount" name="discountBasisPoints" type="number" min="0" max="10000" step="1" value="0" />
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

      <Card>
        <h2>Expiry job</h2>
        <form method="POST" action="?/expireMemberships" class="form-stack">
          <Field label="Expire before" id="as-of">
            <input id="as-of" name="asOf" type="datetime-local" />
          </Field>
          <Field label="Limit" id="expire-limit">
            <input id="expire-limit" name="limit" type="number" min="1" max="500" step="1" value="100" />
          </Field>
          <Button type="submit" variant="ghost">Expire due memberships</Button>
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

  .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .form-stack {
    display: grid;
    gap: 12px;
    margin-block-start: 16px;
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
</style>
