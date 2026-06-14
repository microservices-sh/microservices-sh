export default function check({ assertFileIncludes }) {
  assertFileIncludes(
    "migrations/0001_billing_subscriptions.sql",
    "CREATE TABLE IF NOT EXISTS subscriptions",
    "Billing-subscriptions migration owns the subscriptions table."
  );
  assertFileIncludes(
    "src/state.ts",
    "past_due",
    "The full Stripe status machine is modeled (not just active/canceled)."
  );
  assertFileIncludes(
    "src/use-cases/apply-stripe-event.ts",
    "recordEventKey",
    "Stripe webhooks are applied idempotently via an event-id ledger."
  );
  assertFileIncludes(
    "src/use-cases/due-for-dunning.ts",
    "past_due",
    "Past-due subscriptions are surfaced for dunning."
  );
}
