<script lang="ts">
	import type { Snippet } from "svelte";
	import type { SummaryRow } from "./types";

	// Compact context card for a customer / invoice / org: avatar initial,
	// title, subtitle, a key/value detail list, and an optional actions area.
	interface Props {
		title: string;
		subtitle?: string;
		initial?: string;
		rows: SummaryRow[];
		actions?: Snippet;
	}

	let { title, subtitle, initial, rows, actions }: Props = $props();
	const mark = $derived((initial ?? title).trim().charAt(0).toUpperCase() || "?");
</script>

<aside class="esp">
	<header class="esp__head">
		<span class="esp__avatar" aria-hidden="true">{mark}</span>
		<div class="esp__id">
			<h2 class="esp__title">{title}</h2>
			{#if subtitle}<p class="esp__subtitle">{subtitle}</p>{/if}
		</div>
	</header>

	<dl class="esp__rows">
		{#each rows as row (row.label)}
			<div class="esp__row">
				<dt>{row.label}</dt>
				<dd>
					{#if row.href}<a href={row.href}>{row.value}</a>{:else}{row.value}{/if}
				</dd>
			</div>
		{/each}
	</dl>

	{#if actions}<div class="esp__actions">{@render actions()}</div>{/if}
</aside>

<style>
	.esp {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-panel);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}
	.esp__head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 18px;
		border-block-end: 1px solid var(--color-line);
	}
	.esp__avatar {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		inline-size: 40px;
		block-size: 40px;
		border-radius: 50%;
		background: var(--color-green-soft);
		color: var(--color-green-dark);
		font-family: var(--font-display, var(--font-sans));
		font-size: 1.1rem;
		font-weight: 600;
	}
	.esp__id {
		min-inline-size: 0;
	}
	.esp__title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
		line-height: 1.2;
		color: var(--color-ink);
		overflow-wrap: anywhere;
	}
	.esp__subtitle {
		margin: 2px 0 0;
		font-size: 0.84rem;
		color: var(--color-ink-soft);
		overflow-wrap: anywhere;
	}
	.esp__rows {
		margin: 0;
		padding: 6px 18px;
	}
	.esp__row {
		display: grid;
		grid-template-columns: minmax(6rem, 0.5fr) 1fr;
		gap: 4px 14px;
		align-items: baseline;
		padding-block: 10px;
		border-block-end: 1px solid var(--color-line);
	}
	.esp__row:last-child {
		border-block-end: none;
	}
	.esp__row dt {
		font-size: 0.76rem;
		font-weight: 500;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-ink-faint);
	}
	.esp__row dd {
		margin: 0;
		font-size: 0.9rem;
		color: var(--color-ink);
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.esp__actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 18px;
		border-block-start: 1px solid var(--color-line);
		background: var(--color-panel-subtle);
	}
</style>
