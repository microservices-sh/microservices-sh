<script lang="ts">
  import { statusBadgeVariant } from "$lib/status";
  import { Button, Card, Alert, Eyebrow, Badge } from "$lib/ui";

  let { data, form } = $props();

  const price = (cents: number, currency: string) =>
    cents === 0 ? "Free" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  const isCurrent = (planId: string) => data.subscription?.planId === planId;
</script>

<svelte:head>
  <title>Billing · SaaS Starter</title>
</svelte:head>

<main class="section">
  <Eyebrow>Subscription billing</Eyebrow>
  <h1>Plans & billing</h1>
  <p>One subscription per organization. Plan and status are owned by the billing module.</p>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {:else if form?.started}
    <Alert tone="success">Subscription started.</Alert>
  {:else if form?.changed}
    <Alert tone="success">Plan changed.</Alert>
  {/if}

  <Card class="mt-6">
    <h2>Current subscription</h2>
    {#if data.subscription}
      <dl class="detail-list">
        <div><dt>Status</dt><dd><Badge tone={statusBadgeVariant(data.subscription.status)}>{data.subscription.status}</Badge></dd></div>
        <div><dt>Access</dt><dd>{data.subscription.hasAccess ? "Active" : "Restricted"}</dd></div>
        <div><dt>Renews</dt><dd>{data.subscription.currentPeriodEnd ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString() : "—"}</dd></div>
      </dl>
    {:else}
      <p>No subscription yet. Choose a plan below to start a 14-day trial.</p>
    {/if}
  </Card>

  <div class="card-grid">
    {#each data.plans as plan}
      <Card>
        <Eyebrow>{plan.name}</Eyebrow>
        <h3>{price(plan.priceCents, plan.currency)}<span class="text-muted text-[0.9rem]"> / {plan.interval}</span></h3>
        <ul class="list mt-4" role="list">
          {#each plan.features as feature}
            <li class="list-item flex items-center gap-2.5">
              <span class="text-accent font-semibold" aria-hidden="true">✓</span>{feature}
            </li>
          {/each}
        </ul>

        {#if data.canManageBilling}
          {#if isCurrent(plan.id)}
            <p class="mt-4"><Badge>Current plan</Badge></p>
          {:else}
            <form method="POST" action="?/selectPlan" class="mt-4">
              <input type="hidden" name="orgId" value={data.activeOrgId ?? ""} />
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="subscriptionId" value={data.subscription?.id ?? ""} />
              <Button type="submit" variant="primary">{data.subscription ? "Switch to this plan" : "Start trial"}</Button>
            </form>
          {/if}
        {/if}
      </Card>
    {/each}
  </div>

  {#if !data.canManageBilling}
    <div class="mt-6">
      <Alert tone="success">You need the <code>org.manage</code> permission to change billing.</Alert>
    </div>
  {/if}
</main>
