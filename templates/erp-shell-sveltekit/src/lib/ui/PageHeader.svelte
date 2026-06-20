<script lang="ts">
	import type { Snippet } from "svelte";

	// Page-level header: kicker + compact title + description, with an optional
	// right-aligned primary-action area and an optional metadata row below.
	interface Props {
		title: string;
		eyebrow?: string;
		description?: string;
		actions?: Snippet;
		meta?: Snippet;
	}

	let { title, eyebrow, description, actions, meta }: Props = $props();
</script>

<header class="ph">
	<div class="ph__row">
		<div class="ph__text">
			{#if eyebrow}<p class="ph__eyebrow">{eyebrow}</p>{/if}
			<h1 class="ph__title">{title}</h1>
			{#if description}<p class="ph__desc">{description}</p>{/if}
		</div>
		{#if actions}<div class="ph__actions">{@render actions()}</div>{/if}
	</div>
	{#if meta}<div class="ph__meta">{@render meta()}</div>{/if}
</header>

<style>
	.ph {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-block-end: 22px;
	}
	.ph__row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 18px;
		flex-wrap: wrap;
	}
	.ph__text {
		min-inline-size: 0;
	}
	.ph__eyebrow {
		margin: 0 0 6px;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-faint);
	}
	/* Deliberately smaller than the global hero h1 — this is a console header. */
	.ph__title {
		max-inline-size: none;
		margin: 0;
		font-family: var(--font-display, var(--font-sans));
		font-size: clamp(1.5rem, 3vw, 1.95rem);
		font-weight: 500;
		line-height: 1.1;
		letter-spacing: -0.02em;
		color: var(--color-ink);
	}
	.ph__desc {
		margin: 6px 0 0;
		max-inline-size: 64ch;
		font-size: 0.92rem;
		color: var(--color-ink-soft);
	}
	.ph__actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}
	.ph__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		padding-block-start: 14px;
		border-block-start: 1px solid var(--color-line);
		font-size: 0.84rem;
		color: var(--color-ink-soft);
	}
</style>
