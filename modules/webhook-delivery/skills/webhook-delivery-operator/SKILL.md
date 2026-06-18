---
name: webhook-delivery-operator
description: Use when managing webhook endpoints, delivery attempts, signing secrets, or outbound event delivery.
---

# Webhook Delivery Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Inspect endpoint, event type, delivery history, and signing-secret state before mutation.
3. Ask for approval before registering endpoints, rotating secrets, or delivering events.
4. Record external integration changes through audit-log when available.

Safe defaults:

- Do not reveal webhook signing secrets.
- Treat outbound delivery as an external side effect requiring approval.
