<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

	interface Props {
		tone?: Tone;
		children: Snippet;
	}

	let { tone = 'neutral', children }: Props = $props();
</script>

<span class="badge badge--{tone}">{@render children()}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		min-block-size: 22px;
		padding-inline: 8px;
		border-radius: 99px;
		border: 1px solid var(--color-line);
		background: var(--color-panel-subtle);
		color: var(--color-ink-soft);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-variant-ligatures: none;
		white-space: nowrap;
	}
	.badge--good {
		color: var(--color-green-dark);
		border-color: rgba(14, 138, 95, 0.28);
		background: var(--color-green-soft);
	}
	.badge--warn {
		color: var(--color-amber);
		border-color: rgba(187, 85, 4, 0.24);
		background: var(--color-amber-soft);
	}
	.badge--bad {
		color: var(--color-red);
		border-color: rgba(223, 27, 65, 0.24);
		background: var(--color-red-soft);
	}
	.badge--info {
		color: #0b73a8;
		border-color: rgba(77, 216, 255, 0.4);
		background: var(--color-cyan-soft);
	}
</style>
