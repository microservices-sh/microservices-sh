# Billing & Subscriptions Reference UI

Reference UI is optional host-app code. The module owns plans, subscriptions, usage records, and dunning hooks.

Admin surface:
- Review plans, subscription state, usage, dunning status, and plan changes.
- Gate reads with `billing.read`; gate changes with `billing.write` or `billing.admin`.

Visitor surface:
- Not applicable by default. Customer-facing billing should be installed by a host template or a dedicated account portal module.

Agentic surface:
- Require approval before starting, changing, cancelling, comping, or extending subscriptions.
