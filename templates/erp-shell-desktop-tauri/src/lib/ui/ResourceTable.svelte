<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		caption: string;
		class?: string;
		head: Snippet;
		children: Snippet;
	}

	let { caption, class: cls = '', head, children }: Props = $props();
</script>

<div class="resource-table {cls}">
	<table>
		<caption>{caption}</caption>
		<thead>
			{@render head()}
		</thead>
		<tbody>
			{@render children()}
		</tbody>
	</table>
</div>

<style>
	.resource-table {
		min-width: 0;
		overflow: visible;
	}

	.resource-table :global(table) {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-panel);
		box-shadow: var(--shadow-sm);
	}

	/* `flush` drops the table's own panel chrome so it can sit inside a Card body
	   (the Card already supplies the border, header divider, and padding). The
	   negative margin cancels the Card's 18px body padding so row dividers reach
	   the card edges; first/last cells re-add 18px so text aligns with the title. */
	.resource-table.flush {
		margin: -18px;
	}
	.resource-table.flush :global(table) {
		border: 0;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
	}
	.resource-table.flush :global(tbody tr:first-child td) {
		border-block-start: 0;
	}

	.resource-table :global(caption) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.resource-table :global(thead) {
		background: var(--color-panel);
	}

	.resource-table :global(th),
	.resource-table :global(td) {
		padding: 12px 16px;
		text-align: start;
		vertical-align: middle;
	}

	.resource-table :global(th) {
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		line-height: 1.2;
		text-transform: uppercase;
	}

	.resource-table :global(td) {
		color: var(--color-ink-soft);
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.resource-table :global(tbody tr + tr td) {
		border-block-start: 1px solid var(--color-line);
	}

	.resource-table :global(tbody tr:first-child td) {
		border-block-start: 1px solid var(--color-line);
	}

	.resource-table :global(tbody tr:hover td),
	.resource-table :global(tbody tr:focus-within td) {
		background: var(--color-surface-2);
	}

	.resource-table :global(td:first-child),
	.resource-table :global(th:first-child) {
		padding-inline-start: 18px;
	}

	.resource-table :global(td:last-child),
	.resource-table :global(th:last-child) {
		padding-inline-end: 18px;
	}

	.resource-table :global(.table-primary) {
		color: var(--color-ink);
		font-weight: 650;
	}

	.resource-table :global(.table-muted) {
		color: var(--color-muted);
		font-size: 0.84rem;
	}

	.resource-table :global(.table-num),
	.resource-table :global(th.table-num) {
		text-align: end;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.resource-table :global(.table-action) {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		white-space: nowrap;
	}
	/* Collapse the action column on rows with no action so a conditional button
	   (e.g. "Record payment" only on open invoices) doesn't leave a padded,
	   hover-highlighted empty cell on paid/void rows. :has(*) is comment-safe —
	   Svelte {#if} anchors are comment nodes, not elements — where :empty isn't. */
	.resource-table :global(td.table-action:not(:has(*))) {
		padding: 0;
	}
	.resource-table :global(tbody tr:hover td.table-action:not(:has(*))),
	.resource-table :global(tbody tr:focus-within td.table-action:not(:has(*))) {
		background: transparent;
	}
	.resource-table :global(th:empty) {
		padding: 0;
		inline-size: 0;
	}

	@media (max-width: 820px) {
		.resource-table :global(table),
		.resource-table :global(thead),
		.resource-table :global(tbody),
		.resource-table :global(tr),
		.resource-table :global(td) {
			display: block;
		}

		.resource-table :global(table) {
			border: 0;
			background: transparent;
			box-shadow: none;
		}

		.resource-table :global(thead) {
			display: none;
		}

		.resource-table :global(tbody) {
			display: grid;
			gap: 10px;
		}

		.resource-table :global(tr) {
			border: 1px solid var(--color-line);
			border-radius: var(--radius-md);
			background: var(--color-panel);
			box-shadow: var(--shadow-sm);
		}

		.resource-table :global(td),
		.resource-table :global(td:first-child),
		.resource-table :global(td:last-child) {
			display: grid;
			gap: 6px;
			padding: 12px 14px;
			border-block-start: 0;
		}

		.resource-table :global(tbody tr + tr td) {
			border-block-start: 0;
		}

		.resource-table :global(td::before) {
			content: attr(data-label);
			color: var(--color-muted);
			font-family: var(--font-mono);
			font-size: 0.68rem;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
		}

		.resource-table :global(.table-action) {
			display: grid;
			grid-template-columns: 1fr;
			justify-content: stretch;
		}

		.resource-table :global(.table-action .btn) {
			width: 100%;
		}
	}
</style>
