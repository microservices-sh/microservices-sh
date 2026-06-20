// Stub for SvelteKit's `$app/stores`. Some @microservices-sh/ui components
// (NavProgress) assume a SvelteKit runtime; the standalone preview harness has
// no Kit, so we alias $app/stores to these no-op stores. Unused components are
// tree-shaken; this just lets the barrel resolve.
import { readable } from "svelte/store";

export const page = readable({ url: new URL("http://localhost/"), params: {}, route: { id: null } });
export const navigating = readable(null);
export const updated = readable(false);
