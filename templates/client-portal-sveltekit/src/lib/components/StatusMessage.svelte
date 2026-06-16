<script lang="ts">
  import type { Snippet } from "svelte";

  // Inline status banner. `error` is the only color variant in the system today;
  // `info` is the neutral/success state. `live` sets aria-live for async results.
  interface Props {
    variant?: "info" | "error";
    live?: boolean;
    class?: string;
    children: Snippet;
  }

  let { variant = "info", live = false, class: klass = "", children }: Props = $props();

  let cls = $derived(["status", variant === "error" ? "error" : "", klass].filter(Boolean).join(" "));
</script>

<div class={cls} aria-live={live ? "polite" : undefined}>{@render children()}</div>
