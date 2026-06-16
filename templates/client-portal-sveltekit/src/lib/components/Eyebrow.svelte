<script lang="ts">
  import type { Snippet } from "svelte";

  // Small uppercase kicker above a heading.
  let { children }: { children: Snippet } = $props();
</script>

<p class="eyebrow">{@render children()}</p>
