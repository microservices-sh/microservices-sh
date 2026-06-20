# Business-Operator Pilot Boundary

The operator lane is useful for product discovery, but hosted operator runtime claims should stay private-pilot until the runtime and approval flows are proven end to end.

## Public Launch Position
Lead with the developer proof workflow:

1. Generate a Cloudflare app with `create-microservices-app`.
2. Inspect module contracts and lockfiles.
3. Plan a payment or provider module addition.
4. Run deterministic checks.
5. Prepare an approval-gated deploy plan.

That path is concrete, local, and understandable without a sales call.

## Pilot-Only Surfaces
Keep these as private-pilot or demo language for now:

| Surface | Current Role | Do Not Claim Yet |
|---------|--------------|------------------|
| Agent Center | Reference UI for scoped agent work, approvals, and audit traces. | Live governed operator workspace for production actions. |
| Hermes runtime | Hosted/BYO runtime concept and CLI surface. | Reliable runtime creation/status until API paths are verified. |
| Ads Manager | Review, insight, draft, and approval-plan surface. | Provider writes such as publish, pause, budget, or schedule changes without tested gates. |
| Marketing Research | Available cite-or-refuse module with standard contracts, reference UI docs, and an operator skill. | Ungated autonomous research runs; external fetches and AI-provider calls still need approval. |

## Gate To Promote Publicly
Promote the operator lane only after these are demonstrated:

- runtime creation and status work without manual intervention
- approval cards persist and can be resumed/rejected
- agent actions write an audit trace
- billing/entitlement gates protect hosted actions
- provider write tools have explicit confirmations and tests
- Marketing Research provider/runtime path is verified with one real approval-gated cite-or-refuse workflow
- one real operator uses the workflow weekly

## Safe Copy
Use:

> Private operator pilot: governed agent workflows for internal teams, with scoped tools, held approvals, and audit-ready plans.

Avoid:

> Autonomous business OS.

> Agents run your company.

> Fully managed research and ads operators.
