# Support Inbox Module Agent Guide

Use this module through `@microservices-sh/support-inbox`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Operational rules:

- Use `getWidgetConfig` for visitor widget bootstrap data.
- Use `startConversation` to reuse an active web or WhatsApp conversation before adding messages.
- Do not add assistant messages when `agentTakeover` is active; the service rejects this.
- Keep raw provider credentials out of D1. Store only secret references on channel connections.
- Do not create tickets or grounded replies inside this module. Use `support-ticket` and `knowledge-base-rag` integrations at route/service boundaries.
- Do not add provider calls, secrets, migrations, or production deploy behavior without approval.
