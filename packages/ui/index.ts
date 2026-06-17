// Optional in-workspace direct import (templates live in the same pnpm
// workspace). The primary distribution is copy-in via `msh-ui` (see README) so
// out-of-workspace repos (web-portal, admin) own their copy. Keep this barrel in
// sync with registry.json.
export { default as Button } from "./components/Button.svelte";
export { default as Card } from "./components/Card.svelte";
export { default as Badge } from "./components/Badge.svelte";
export { default as Alert } from "./components/Alert.svelte";
export { default as Field } from "./components/Field.svelte";
export { default as Eyebrow } from "./components/Eyebrow.svelte";
