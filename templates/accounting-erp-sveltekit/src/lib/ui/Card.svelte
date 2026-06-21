<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		class?: string;
		header?: Snippet;
		children: Snippet;
	}

	let { title, class: cls = '', header, children }: Props = $props();
</script>

<section class="card {cls}">
	{#if title || header}
		<header class="card__head">
			{#if title}<h3 class="card__title">{title}</h3>{/if}
			{#if header}{@render header()}{/if}
		</header>
	{/if}
	<div class="card__body">
		{@render children()}
	</div>
</section>

<style>
	.card {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-panel);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}
	.card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 18px;
		border-block-end: 1px solid var(--color-line);
	}
	.card__title {
		font-size: 0.95rem;
		letter-spacing: 0;
	}
	.card__body {
		padding: 18px;
	}
</style>
