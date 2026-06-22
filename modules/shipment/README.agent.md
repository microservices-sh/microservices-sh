# Shipment Module Agent Guide

Use this module through `@microservices-sh/shipment`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm check:spec`.
5. Run `pnpm build` after source edits.

Do not add provider calls, secrets, migrations, or production deploy behavior without approval.

Shipment status mutations are approval-sensitive. Use `startShipmentProcessing` for draft-to-processing work and `completeShipment` for inventory-deducting completion; do not bypass those use cases by writing `shipment_batches.status` directly.
