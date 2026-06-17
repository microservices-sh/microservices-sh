<script lang="ts">
	// Self-contained: the item shape is declared here so the component has no
	// external type dependency (portable across repos).
	export interface UsageItem {
		key: string;
		label: string;
		used: number;
		limit: number | null;
		unit?: string;
	}

	interface Props {
		item: UsageItem;
	}
	let { item }: Props = $props();

	const pct = $derived(
		item.limit && item.limit > 0 ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0
	);
	const near = $derived(item.limit !== null && pct >= 80);
	const display = $derived(
		item.limit === null ? `${item.used}${item.unit ?? ''}` : `${item.used}/${item.limit}${item.unit ?? ''}`
	);
</script>

<div class="row">
	<span class="row__label" id="usage-{item.key}">{item.label}</span>
	<div
		class="track"
		role="progressbar"
		aria-labelledby="usage-{item.key}"
		aria-valuenow={pct}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuetext={display}
	>
		<i class="fill" class:fill--near={near} style="--value:{pct}%"></i>
	</div>
	<b class="row__value">{display}</b>
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: minmax(120px, 0.8fr) minmax(0, 1.4fr) minmax(5.5rem, auto);
		align-items: center;
		gap: 12px;
		font-size: 0.82rem;
		color: var(--color-ink-soft);
	}
	.row__value {
		text-align: end;
		font-weight: 600;
		color: var(--color-ink);
	}
	.track {
		block-size: 6px;
		border-radius: 99px;
		background: var(--color-paper-2);
		overflow: hidden;
		border: 1px solid var(--color-line);
	}
	.fill {
		display: block;
		block-size: 100%;
		inline-size: var(--value);
		background: var(--color-green);
		border-radius: inherit;
		transition: inline-size 400ms var(--ease);
	}
	.fill--near {
		background: var(--color-amber);
	}
	@media (max-width: 620px) {
		.row {
			grid-template-columns: 1fr auto;
		}
		.track {
			display: none;
		}
	}
</style>
