# Commerce Sync Use Cases

- `createCommerceConnection`
- `recordProviderMapping`
- `startSyncRun`
- `completeSyncRun`
- `recordWebhookReceipt`
- `normalizeCommercePayload`
- `normalizeCommerceProviderPayload`
- `verifyWooCommerceWebhookSignature`
- `WooCommerceClient`
- `parseWooCommerceCredentials`

Do not import SvelteKit, Hono, or secret values directly in use cases. Provider clients must receive resolved credentials explicitly.
