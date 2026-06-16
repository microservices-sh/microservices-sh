<script lang="ts">
  import type { Snippet } from "svelte";
  import type { BadgeVariant } from "./types";

  // Small status pill. Variant maps to the `.pill.is-*` tokens; `default` is the
  // accent pill. Use `statusBadgeVariant()` from $lib/status to map a domain
  // status string to a variant.
  interface Props {
    variant?: BadgeVariant;
    children: Snippet;
  }

  let { variant = "default", children }: Props = $props();

  let cls = $derived(["pill", variant === "default" ? "" : `is-${variant}`].filter(Boolean).join(" "));
</script>

<span class={cls}>{@render children()}</span>
