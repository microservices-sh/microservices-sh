<script lang="ts">
	import type { Metric } from "./types";

	// KPI row. Each metric may link to its source page and carries a tone that
	// tints the value + accent bar (e.g. overdue = bad, paid = good).
	let { metrics }: { metrics: Metric[] } = $props();
</script>

<div class="ms">
	{#each metrics as m (m.label)}
		<svelte:element
			this={m.href ? "a" : "div"}
			href={m.href}
			class="ms__card ms__card--{m.tone ?? 'neutral'}"
			class:ms__card--link={!!m.href}
		>
			<span class="ms__label">{m.label}</span>
			<strong class="ms__value">{m.value}</strong>
			{#if m.hint}<span class="ms__hint">{m.hint}</span>{/if}
		</svelte:element>
	{/each}
</div>

<style>
	.ms {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
	}
	.ms__card {
		position: relative;
		display: grid;
		gap: 7px;
		padding: 16px 18px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-panel);
		box-shadow: var(--shadow-sm);
		color: var(--color-ink);
		text-decoration: none;
		overflow: hidden;
		transition:
			transform 200ms var(--ease),
			border-color 200ms var(--ease),
			box-shadow 200ms var(--ease);
	}
	.ms__card::before {
		content: "";
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		inline-size: 3px;
		background: var(--accent, var(--color-line-strong));
	}
	.ms__card--link:hover {
		transform: translateY(-2px);
		border-color: var(--accent, var(--color-act));
		box-shadow: var(--shadow-card);
	}
	.ms__card--good {
		--accent: var(--color-green-dark);
	}
	.ms__card--warn {
		--accent: var(--color-amber);
	}
	.ms__card--bad {
		--accent: var(--color-red);
	}
	.ms__card--info {
		--accent: var(--color-cyan);
	}
	.ms__card--neutral {
		--accent: var(--color-line-strong);
	}
	.ms__label {
		font-size: 0.76rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink-faint);
	}
	.ms__value {
		font-family: var(--font-display, var(--font-sans));
		font-size: 1.9rem;
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
	}
	.ms__hint {
		font-size: 0.8rem;
		color: var(--color-ink-soft);
	}
</style>
