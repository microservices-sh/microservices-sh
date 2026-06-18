<script lang="ts">
  import { enhance } from "$app/forms";
  import { Card, Eyebrow, Badge, Button, Alert } from "$lib/ui";

  let { data, form } = $props();

  const money = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  const when = (iso: string) => new Date(iso).toLocaleDateString();

  function tone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "succeeded":
      case "paid":
        return "good";
      case "refunded":
        return "neutral";
      case "failed":
        return "bad";
      default:
        return "warn";
    }
  }
</script>

<svelte:head>
  <title>Payments · ERP Shell</title>
</svelte:head>

<main class="section">
  <Eyebrow>Payment ledger</Eyebrow>
  <h1>Payments</h1>
  <p>Captured payments for your company, powered by the payment module.</p>

  {#if form?.refunded}
    <Alert tone="success">Payment refunded.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <Card class="mt-6">
    <h2>Transactions</h2>
    {#if data.payments.length > 0}
      <ul class="list" role="list">
        {#each data.payments as p}
          <li class="list-item row-item">
            <span>
              <strong>{money(p.amount, p.currency)}</strong> · {p.customer}
              {#if p.description}<span class="pay-desc">— {p.description}</span>{/if}
              <span class="pay-meta">{when(p.createdAt)}</span>
            </span>
            <span class="nav" style="align-items: center;">
              <Badge tone={tone(p.status)}>{p.status}</Badge>
              {#if data.canManage && p.status !== "refunded"}
                <form method="POST" action="?/refund" use:enhance>
                  <input type="hidden" name="intentId" value={p.intentId} />
                  <Button type="submit" variant="ghost" size="sm">Refund</Button>
                </form>
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No payments yet. They appear here once captured through checkout (createPaymentIntent → webhook).</p>
    {/if}
  </Card>
</main>

<style>
  .pay-desc {
    color: var(--color-ink-soft);
    font-size: 0.9rem;
  }
  .pay-meta {
    display: block;
    color: var(--color-ink-faint);
    font-size: 0.78rem;
    font-family: var(--font-mono);
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
</style>
