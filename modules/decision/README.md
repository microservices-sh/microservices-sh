# Decision Module

Advise pillar for microservices.sh. Produces cited, human-owned **decision briefs** and
records an **append-only decision log**. Accepted decisions **close into action** by
dispatching a task to an executor (operator-work / jobs-workflows).

## Why it exists

Chatbots give uncited advice that goes nowhere. This module enforces:

- **Cite-or-refuse** — a recommendation must cite at least one provided source, or it is refused (422).
- **Human-owned** — a drafted brief is never auto-decided; a person records the decision.
- **Auditable** — every draft and decision writes a domain event and an audit entry.
- **Closed-loop** — an accepted decision produces an action request (a task), not just text.

## Use cases

- `draftDecisionBrief(input, deps)` — draft options/risks/recommendation from context + sources.
- `recordDecision(input, deps)` — accept/reject/defer a brief; appends a log entry.
- `listDecisions({ briefId }, deps)` — full decision history for a brief.

Ports are injected: `DecisionProposer` (LLM), `DecisionStore` (memory or D1),
`ActionDispatcher` (task hand-off), `AuditSink` (audit-log).
