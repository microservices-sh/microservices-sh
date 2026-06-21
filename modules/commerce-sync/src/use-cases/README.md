# Commerce Sync Use Cases

- `createCommerceConnection`
- `recordProviderMapping`
- `startSyncRun`
- `completeSyncRun`
- `recordWebhookReceipt`
- `normalizeCommercePayload`
- `normalizeCommerceProviderPayload`
- `syncWooCommercePage`
- `verifyWooCommerceWebhookSignature`
- `WooCommerceClient`
- `parseWooCommerceCredentials`

Do not import SvelteKit, Hono, or secret values directly in use cases. Provider clients must receive resolved credentials explicitly.
`syncWooCommercePage` receives an already-authenticated `WooCommerceClient` and an optional host callback for resolving normalized payloads to local IDs before recording provider mappings.
