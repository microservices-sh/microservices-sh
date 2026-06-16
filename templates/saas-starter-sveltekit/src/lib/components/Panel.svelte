<script lang="ts">
  import type { Snippet } from "svelte";

  // Surface card. `as` chooses the element so it stays semantic (section by
  // default; aside/div where appropriate). Extra attributes (style, aria-label)
  // pass through.
  interface Props {
    as?: "section" | "div" | "aside" | "form";
    class?: string;
    children: Snippet;
    [key: string]: unknown;
  }

  let { as = "section", class: klass = "", children, ...rest }: Props = $props();

  let cls = $derived(["panel", klass].filter(Boolean).join(" "));
</script>

<svelte:element this={as} class={cls} {...rest}>{@render children()}</svelte:element>
