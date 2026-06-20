<script lang="ts">
  // Interactive wrapper for the billing-subscriptions module. Auto-discovered by the
  // harness (wrappers/<module-id>.svelte). No live backend — the demo mirrors the
  // real use cases: startSubscription (subscription.started), changePlan
  // (plan_changed), and applyStripeEvent moving status across the full Stripe set
  // (activated / past_due / canceled). Access is derived from status in the Preview.
  import Preview from "@microservices-sh/billing-subscriptions/preview";

  let { module: m }: { module: any } = $props();

  const plans = [
    { id: "pl_starter", name: "Starter", priceCents: 1900, currency: "USD", interval: "month" as const, features: ["1 project", "Community support"] },
    { id: "pl_pro", name: "Pro", priceCents: 4900, currency: "USD", interval: "month" as const, features: ["10 projects", "Email support", "Usage metering"] },
    { id: "pl_scale", name: "Scale", priceCents: 19900, currency: "USD", interval: "month" as const, features: ["Unlimited", "Priority support", "SSO"] }
  ];

  const periodEnd = () => new Date(Date.now() + 24 * 864e5).toISOString();
  let subscription = $state<any>({ planId: "pl_pro", status: "active", currentPeriodEnd: periodEnd(), cancelAtPeriodEnd: false });

  function onstart(planId: string) {
    // startSubscription → subscription.started (new subs begin trialing)
    subscription = { planId, status: "trialing", currentPeriodEnd: periodEnd(), cancelAtPeriodEnd: false };
  }
  function onchangeplan(planId: string) {
    // changePlan → subscription.plan_changed (status unchanged)
    subscription = { ...subscription, planId };
  }
  function onstatus(status: string) {
    // applyStripeEvent → subscription.activated / past_due / canceled (+ updated)
    subscription = { ...subscription, status, cancelAtPeriodEnd: status === "canceled" ? false : subscription.cancelAtPeriodEnd };
  }
  function oncancelatperiodend() {
    // cancelSubscription(atPeriodEnd) — flagged now, ends at renewal
    subscription = { ...subscription, cancelAtPeriodEnd: true };
  }
</script>

<Preview {plans} {subscription} {onstart} {onchangeplan} {onstatus} {oncancelatperiodend} />
