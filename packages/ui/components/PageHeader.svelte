<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		eyebrow: string;
		title: string;
		description?: string;
		actions?: Snippet;
	}
	let { eyebrow, title, description, actions }: Props = $props();
</script>

<header class="head">
	<div>
		<p class="eyebrow">{eyebrow}</p>
		<h1>{title}</h1>
		{#if description}<p class="desc">{description}</p>{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px;
		margin-block-end: 28px;
	}
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.02em;
		color: var(--color-ink-faint);
	}
	.eyebrow::before {
		content: '';
		inline-size: 18px;
		block-size: 1px;
		background: var(--color-line-strong);
	}
	h1 {
		font-size: 1.6rem;
		letter-spacing: 0;
	}
	.desc {
		margin: 6px 0 0;
		color: var(--color-ink-soft);
		max-inline-size: 60ch;
	}
	.actions {
		display: inline-flex;
		gap: 10px;
		flex: none;
	}
</style>
