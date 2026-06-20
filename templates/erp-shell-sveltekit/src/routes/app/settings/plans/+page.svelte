<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Badge, Button, Field, Alert, ResourceTable, EmptyState } from "$lib/ui";

  let { data, form } = $props();

  const money = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
</script>

<svelte:head>
  <title>Plans · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Billing"
    title="Plans"
    description="The plan catalog for the billing-subscriptions module — review and create the recurring plans customers subscribe to."
  />

  {#if form?.created === "plan"}
    <Alert tone="success">Plan created.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="stack">
    <Card title="Plans">
      {#snippet header()}
        <Badge tone="neutral">{data.plans.length}</Badge>
      {/snippet}
      {#if data.plans.length > 0}
        <ResourceTable class="flush" caption="Subscription plans">
          {#snippet head()}
            <tr>
              <th>Plan</th>
              <th class="table-num">Price</th>
              <th>Status</th>
            </tr>
          {/snippet}
          {#each data.plans as plan (plan.id)}
            <tr>
              <td data-label="Plan" class="table-primary">{plan.name}</td>
              <td data-label="Price" class="table-num">
                {money(plan.priceCents, plan.currency)}/{plan.interval}
              </td>
              <td data-label="Status">
                <Badge tone={plan.status === "active" ? "good" : "neutral"}>{plan.status}</Badge>
              </td>
            </tr>
          {/each}
        </ResourceTable>
      {:else}
        <EmptyState
          title="No plans yet"
          description="Create one to start subscribing customers."
        />
      {/if}
    </Card>

    {#if data.canManage}
      <Card title="Create a plan">
        <form method="POST" action="?/createPlan" use:enhance>
          <Field label="Plan name" id="name" required>
            <input id="name" name="name" required placeholder="Pro" />
          </Field>
          <div class="bill-row">
            <Field label="Price (USD)" id="price" required>
              <input id="price" name="price" type="number" min="0" step="0.01" required placeholder="49.00" />
            </Field>
            <Field label="Interval" id="interval">
              <select id="interval" name="interval">
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </Field>
          </div>
          <Button type="submit" variant="primary">Create plan</Button>
        </form>
      </Card>
    {/if}
  </div>
</main>

<style>
  .stack {
    display: grid;
    gap: 18px;
    margin-block-start: 4px;
    align-items: start;
  }
  .bill-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
</style>
