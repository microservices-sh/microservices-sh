# Ads Manager Reference UI

Admin:

- Show connection status and account references without exposing provider tokens.
- Show campaign performance when the upstream connector is configured.
- Show insight snapshots, anomaly alerts, and a performance-review summary.
- Provide explicit sync controls only after entitlement and approval checks.
- Include non-mutating copy draft and publish-plan panels so operators can prepare campaigns without implying provider writes are available.

Visitor:

- Not applicable. Ads operations are authenticated operator workflows only.

Agentic:

- Use read-only campaign and insight tools first.
- Require approval before connecting accounts, disconnecting accounts, or syncing external ad data.
- Treat generated ad copy as draft output unless a separate approved persistence/publish tool is present.
- Treat scheduling/publishing as an approval-ready plan. Real provider writes require an upstream write-capable ads service/tool.

Examples:

- SaaS starter: `templates/saas-starter-sveltekit/src/routes/app/ads/+page.svelte`
- ERP shell: `templates/erp-shell-sveltekit/src/routes/app/ads/+page.svelte`
