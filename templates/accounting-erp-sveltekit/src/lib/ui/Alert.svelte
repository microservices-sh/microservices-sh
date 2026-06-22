<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'error' | 'success' | 'warn' | 'info';
		children: Snippet;
	}
	let { tone = 'error', children }: Props = $props();
</script>

<div
	class="alert alert--{tone}"
	role={tone === 'error' ? 'alert' : 'status'}
	aria-live={tone === 'error' ? 'assertive' : 'polite'}
>
	{#if tone === 'error'}
		<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
			<path d="M12 9v4" /><path d="M12 17h.01" />
		</svg>
	{:else if tone === 'success'}
		<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M20 6 9 17l-5-5" />
		</svg>
	{:else if tone === 'warn'}
		<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="9" /><path d="M12 12h.01" /><path d="M11 16h2v-4h-2" />
		</svg>
	{/if}
	<span>{@render children()}</span>
</div>

<style>
	.alert {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 16px;
		padding: 9px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.83rem;
		line-height: 1.45;
	}
	.alert svg {
		flex: none;
	}
	.alert--error {
		border: 1px solid rgba(223, 27, 65, 0.24);
		background: var(--color-red-soft);
		color: var(--color-red);
	}
	.alert--success {
		border: 1px solid var(--color-green-dark);
		background: var(--color-green-soft);
		color: var(--color-green-dark);
	}
	.alert--warn {
		border: 1px solid rgba(181, 117, 4, 0.26);
		background: var(--color-amber-soft);
		color: var(--color-amber);
	}
	.alert--info {
		border: 1px solid rgba(11, 115, 168, 0.24);
		background: var(--color-cyan-soft);
		color: #0b73a8;
	}
</style>
