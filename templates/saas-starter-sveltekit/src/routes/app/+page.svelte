<script lang="ts">
  import { statusPillClass } from "$lib/status";

  let { data } = $props();
</script>

<svelte:head>
  <title>Dashboard · SaaS Starter</title>
</svelte:head>

{#if data.onboarding}
  <main class="section">
    <section class="panel">
      <p class="eyebrow">Almost there</p>
      <h1>Create your first organization.</h1>
      <p>You're signed in but not a member of any organization yet.</p>
      <a class="button" href="/signup">Create an organization</a>
    </section>
  </main>
{:else}
  <main class="section">
    <p class="eyebrow">Organization dashboard</p>
    <h1>Overview</h1>
    <p>Everything below is scoped to your active organization and gated by your role.</p>

    <div class="stat-grid">
      <a class="stat-card" href="/app/team">
        <span>Members</span>
        <strong>{data.memberCount}</strong>
      </a>
      <a class="stat-card" href="/app/billing">
        <span>Plan</span>
        <strong>{data.subscription ? data.subscription.planId.replace("plan_", "").slice(0, 8) : "—"}</strong>
      </a>
      <div class="stat-card">
        <span>Subscription</span>
        {#if data.subscription}
          <span class={statusPillClass(data.subscription.status)}>{data.subscription.status}</span>
        {:else}
          <span class="pill is-muted">none</span>
        {/if}
      </div>
    </div>

    {#if !data.subscription}
      <div class="status">No active subscription. <a href="/app/billing">Choose a plan</a> to unlock paid features.</div>
    {:else if !data.subscription.hasAccess}
      <div class="status error">Subscription is {data.subscription.status}. Paid features are gated until it returns to good standing.</div>
    {/if}
  </main>
{/if}
