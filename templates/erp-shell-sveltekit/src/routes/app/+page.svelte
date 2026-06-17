<script lang="ts">
  import { Button, Card, Eyebrow } from "$lib/ui";

  let { data } = $props();

  const money = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
</script>

<svelte:head>
  <title>Dashboard · ERP Shell</title>
</svelte:head>

{#if data.onboarding}
  <main class="section">
    <Card>
      <Eyebrow>Almost there</Eyebrow>
      <h1>Set up your company.</h1>
      <p>You're signed in but your company workspace isn't set up yet.</p>
      <Button href="/signup" variant="primary">Set up the company</Button>
    </Card>
  </main>
{:else}
  <main class="section">
    <Eyebrow>Company operations</Eyebrow>
    <h1>Overview</h1>
    <p>Everything below is scoped to your company and gated by your role.</p>

    <div class="stat-grid">
      <a class="stat-card" href="/app/customers">
        <span>Customers</span>
        <strong>{data.customerCount}</strong>
      </a>
      <a class="stat-card" href="/app/invoices">
        <span>Invoices</span>
        <strong>{data.invoiceCount}</strong>
      </a>
      <a class="stat-card" href="/app/invoices">
        <span>Outstanding</span>
        <strong>{money(data.outstandingCents, data.currency)}</strong>
      </a>
      <a class="stat-card" href="/app/team">
        <span>Team</span>
        <strong>{data.memberCount}</strong>
      </a>
    </div>
  </main>
{/if}
