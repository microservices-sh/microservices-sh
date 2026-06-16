<script lang="ts">
  import type { Snippet } from "svelte";

  // Polymorphic action: renders an <a> when `href` is set, otherwise a <button>.
  // Styling lives in the global `.button` utility (token-driven) — this component
  // is the single sanctioned way to render one, so context (e.g. a nav row) can
  // never silently override its colors.
  interface Props {
    href?: string;
    type?: "submit" | "button" | "reset";
    variant?: "primary" | "secondary" | "ghost";
    class?: string;
    children: Snippet;
    [key: string]: unknown;
  }

  let {
    href = undefined,
    type = "submit",
    variant = "primary",
    class: klass = "",
    children,
    ...rest
  }: Props = $props();

  let cls = $derived(["button", variant === "primary" ? "" : variant, klass].filter(Boolean).join(" "));
</script>

{#if href !== undefined}
  <a {href} class={cls} {...rest}>{@render children()}</a>
{:else}
  <button {type} class={cls} {...rest}>{@render children()}</button>
{/if}
