<script lang="ts">
  import { statusPillClass } from "$lib/status";

  let { data, form } = $props();

  const price = (cents: number, currency: string) =>
    cents === 0 ? "Free" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  const isCurrent = (planId: string) => data.subscription?.planId === planId;
</script>

<svelte:head>
  <title>Billing · SaaS Starter</title>
</svelte:head>

<main class="section">
  <p class="eyebrow">Subscription billing</p>
  <h1>Plans & billing</h1>
  <p>One subscription per organization. Plan and status are owned by the billing module.</p>

  {#if form?.error}
    <div class="status error" aria-live="polite">{form.error}</div>
  {:else if form?.started}
    <div class="status">Subscription started.</div>
  {:else if form?.changed}
    <div class="status">Plan changed.</div>
  {/if}

  <section class="panel mt-6">
    <h2>Current subscription</h2>
    {#if data.subscription}
      <dl class="detail-list">
        <div><dt>Status</dt><dd><span class={statusPillClass(data.subscription.status)}>{data.subscription.status}</span></dd></div>
        <div><dt>Access</dt><dd>{data.subscription.hasAccess ? "Active" : "Restricted"}</dd></div>
        <div><dt>Renews</dt><dd>{data.subscription.currentPeriodEnd ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString() : "—"}</dd></div>
      </dl>
    {:else}
      <p>No subscription yet. Choose a plan below to start a 14-day trial.</p>
    {/if}
  </section>

  <div class="card-grid">
    {#each data.plans as plan}
      <section class="panel">
        <p class="eyebrow">{plan.name}</p>
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
            <p class="mt-4"><span class="pill">Current plan</span></p>
          {:else}
            <form method="POST" action="?/selectPlan" class="mt-4">
              <input type="hidden" name="orgId" value={data.activeOrgId ?? ""} />
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="subscriptionId" value={data.subscription?.id ?? ""} />
              <button type="submit">{data.subscription ? "Switch to this plan" : "Start trial"}</button>
            </form>
          {/if}
        {/if}
      </section>
    {/each}
  </div>

  {#if !data.canManageBilling}
    <div class="status mt-6">You need the <code>org.manage</code> permission to change billing.</div>
  {/if}
</main>
