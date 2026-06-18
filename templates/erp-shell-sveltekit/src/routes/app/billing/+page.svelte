<script lang="ts">
  import { enhance } from "$app/forms";
  import { Card, Eyebrow, Badge, Button, Field, Alert } from "$lib/ui";

  let { data, form } = $props();

  const money = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  function tone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "active":
      case "trialing":
        return "good";
      case "past_due":
      case "unpaid":
        return "warn";
      case "canceled":
        return "neutral";
      default:
        return "neutral";
    }
  }
</script>

<svelte:head>
  <title>Billing · ERP Shell</title>
</svelte:head>

<main class="section">
  <Eyebrow>Recurring billing</Eyebrow>
  <h1>Billing</h1>
  <p>Subscription plans and customer subscriptions, powered by the billing-subscriptions module.</p>

  {#if form?.created === "plan"}
    <Alert tone="success">Plan created.</Alert>
  {:else if form?.created === "subscription"}
    <Alert tone="success">Subscription started.</Alert>
  {:else if form?.canceled}
    <Alert tone="success">Subscription canceled.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card>
      <h2>Plans</h2>
      {#if data.plans.length > 0}
        <ul class="list" role="list">
          {#each data.plans as plan}
            <li class="list-item row-item">
              <span><strong>{plan.name}</strong> · {money(plan.priceCents, plan.currency)}/{plan.interval}</span>
              <Badge tone={plan.status === "active" ? "good" : "neutral"}>{plan.status}</Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No plans yet — create one to start subscribing customers.</p>
      {/if}

      {#if data.canManage}
        <form method="POST" action="?/createPlan" use:enhance class="mt-4">
          <Field label="Plan name" id="name"><input id="name" name="name" required placeholder="Pro" /></Field>
          <div class="bill-row">
            <Field label="Price (USD)" id="price"><input id="price" name="price" type="number" min="0" step="0.01" required placeholder="49.00" /></Field>
            <Field label="Interval" id="interval">
              <select id="interval" name="interval"><option value="month">Monthly</option><option value="year">Yearly</option></select>
            </Field>
          </div>
          <Button type="submit" variant="primary">Create plan</Button>
        </form>
      {/if}
    </Card>

    <Card>
      <h2>Subscriptions</h2>
      {#if data.subscriptions.length > 0}
        <ul class="list" role="list">
          {#each data.subscriptions as sub}
            <li class="list-item row-item">
              <span><strong>{sub.subscriber}</strong> · {sub.plan}</span>
              <span class="nav" style="align-items: center;">
                <Badge tone={tone(sub.status)}>{sub.status}</Badge>
                {#if data.canManage && sub.status !== "canceled"}
                  <form method="POST" action="?/cancel" use:enhance>
                    <input type="hidden" name="subscriptionId" value={sub.id} />
                    <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                  </form>
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No subscriptions yet.</p>
      {/if}

      {#if data.canManage && data.plans.length > 0 && data.customers.length > 0}
        <form method="POST" action="?/startSubscription" use:enhance class="mt-4">
          <Field label="Customer" id="subscriberId">
            <select id="subscriberId" name="subscriberId" required>
              <option value="" disabled selected>Choose a customer…</option>
              {#each data.customers as c}<option value={c.id}>{c.name}</option>{/each}
            </select>
          </Field>
          <Field label="Plan" id="planId">
            <select id="planId" name="planId" required>
              <option value="" disabled selected>Choose a plan…</option>
              {#each data.plans as p}<option value={p.id}>{p.name}</option>{/each}
            </select>
          </Field>
          <Button type="submit" variant="primary">Start subscription</Button>
        </form>
      {/if}
    </Card>
  </div>
</main>

<style>
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  .bill-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
</style>
