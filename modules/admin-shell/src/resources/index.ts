// Admin Shell owns no tables of its own — it composes over the host app's
// existing D1 tables, declared at runtime via a ResourceRegistry. The DB binding
// is supplied by the host when constructing the gateway adapter.
export const resources = [] as const;
