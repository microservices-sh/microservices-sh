<script lang="ts">
  // Interactive wrapper for the payment module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real use
  // cases: createPaymentIntent (payment.checkout_created, status pending),
  // handleWebhook (payment.succeeded / payment.failed — the only way pending
  // advances), refundPayment (payment.refunded). The charge is never advanced
  // optimistically; it waits for the simulated verified webhook.
  import Preview from "@microservices-sh/payment/preview";

  let { module: m }: { module: any } = $props();

  let seq = 1;
  const intentId = () => `pi_${(seq + 1000).toString(36)}${seq}`;
  let payments = $state<any[]>([
    { id: `pay_${seq++}`, intentId: "pi_seed1", customerId: "cus_grace", amount: 4900, currency: "USD", status: "succeeded", description: "Pro plan — Apr", createdAt: new Date(Date.now() - 5 * 864e5).toISOString() },
    { id: `pay_${seq++}`, intentId: "pi_seed2", customerId: "cus_alan", amount: 19900, currency: "USD", status: "refunded", description: "Scale — annual (refunded)", createdAt: new Date(Date.now() - 9 * 864e5).toISOString() }
  ]);

  function oncreate(input: { amount: number; customerId: string; description: string | null }) {
    // createPaymentIntent → payment.checkout_created (starts pending)
    payments = [{ id: `pay_${seq++}`, intentId: intentId(), customerId: input.customerId, amount: input.amount, currency: "USD", status: "pending", description: input.description, createdAt: new Date().toISOString() }, ...payments];
  }
  function onwebhook(id: string, outcome: "succeeded" | "failed") {
    // handleWebhook (signature-verified) → payment.succeeded | payment.failed
    payments = payments.map((p) => (p.id === id && p.status === "pending" ? { ...p, status: outcome } : p));
  }
  function onrefund(id: string) {
    // refundPayment → payment.refunded (only a succeeded charge)
    payments = payments.map((p) => (p.id === id && p.status === "succeeded" ? { ...p, status: "refunded" } : p));
  }
</script>

<Preview {payments} {oncreate} {onwebhook} {onrefund} />
