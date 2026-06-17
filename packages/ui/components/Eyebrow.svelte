<script lang="ts">
	import type { Snippet } from 'svelte';

	// Small uppercase monospace kicker above a heading (brand signature).
	let { children }: { children: Snippet } = $props();
</script>

<p class="eyebrow">{@render children()}</p>

<style>
	.eyebrow {
		margin: 0 0 6px;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-faint);
	}
</style>
