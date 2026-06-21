<script lang="ts">
  import { statusBadgeVariant } from "$lib/status";
  import { Button, Card, Alert, Eyebrow, Badge } from "$lib/ui";

  let { data } = $props();
</script>

<svelte:head>
  <title>Dashboard · SaaS Starter</title>
</svelte:head>

{#if data.onboarding}
  <main class="section">
    <Card>
      <Eyebrow>Almost there</Eyebrow>
      <h1>Create your first organization.</h1>
      <p>You're signed in but not a member of any organization yet.</p>
      <Button href="/signup" variant="primary">Create an organization</Button>
    </Card>
  </main>
{:else}
  <main class="section">
    <Eyebrow>Organization dashboard</Eyebrow>
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
          <Badge tone={statusBadgeVariant(data.subscription.status)}>{data.subscription.status}</Badge>
        {:else}
          <Badge tone="neutral">none</Badge>
        {/if}
      </div>
    </div>

    {#if !data.subscription}
      <Alert tone="success">No active subscription. <a href="/app/billing">Choose a plan</a> to unlock paid features.</Alert>
    {:else if !data.subscription.hasAccess}
      <Alert tone="error">Subscription is {data.subscription.status}. Paid features are gated until it returns to good standing.</Alert>
    {/if}
  </main>
{/if}
