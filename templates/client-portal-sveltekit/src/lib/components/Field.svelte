<script lang="ts">
  import type { Snippet } from "svelte";

  // Labeled form control. Pass the input/select/textarea as the default slot;
  // give it the same `id` so the label's `for` associates correctly.
  interface Props {
    label: string;
    id?: string;
    hint?: string;
    children: Snippet;
  }

  let { label, id = undefined, hint = undefined, children }: Props = $props();
</script>

<div class="field">
  <label for={id}>{label}</label>
  {@render children()}
  {#if hint}<span class="field-hint">{hint}</span>{/if}
</div>
