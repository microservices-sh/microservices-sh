<script lang="ts">
	import type { Snippet } from "svelte";

	// Consistent "nothing here yet — do this next" block. Pass an optional icon
	// snippet and an action snippet (usually a Button).
	interface Props {
		title: string;
		description?: string;
		icon?: Snippet;
		action?: Snippet;
	}

	let { title, description, icon, action }: Props = $props();
</script>

<div class="empty">
	{#if icon}<div class="empty__icon" aria-hidden="true">{@render icon()}</div>{/if}
	<h3 class="empty__title">{title}</h3>
	{#if description}<p class="empty__desc">{description}</p>{/if}
	{#if action}<div class="empty__action">{@render action()}</div>{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 34px 20px;
		text-align: center;
	}
	.empty__icon {
		display: grid;
		place-items: center;
		inline-size: 40px;
		block-size: 40px;
		margin-block-end: 4px;
		border-radius: 50%;
		background: var(--color-panel-subtle);
		color: var(--color-ink-faint);
	}
	.empty__title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-ink);
	}
	.empty__desc {
		margin: 0;
		max-inline-size: 42ch;
		font-size: 0.88rem;
		color: var(--color-ink-soft);
	}
	.empty__action {
		margin-block-start: 6px;
	}
</style>
