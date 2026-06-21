<script lang="ts">
	import type { RailAction } from "./types";

	// "Next best actions" list for a workflow page. Data-driven (links only, so
	// it serializes cleanly from a server load); the primary action is emphasised.
	let { actions, title = "Next actions" }: { actions: RailAction[]; title?: string } = $props();
</script>

<nav class="rail" aria-label={title}>
	<p class="rail__title">{title}</p>
	<ul class="rail__list">
		{#each actions as a (a.label)}
			<li>
				<a class="rail__item" class:rail__item--primary={a.primary} href={a.href ?? "#"}>
					<span class="rail__label">{a.label}</span>
					{#if a.description}<span class="rail__desc">{a.description}</span>{/if}
					<span class="rail__chev" aria-hidden="true">→</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.rail {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-panel);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}
	.rail__title {
		margin: 0;
		padding: 13px 16px;
		border-block-end: 1px solid var(--color-line);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-faint);
	}
	.rail__list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rail__item {
		position: relative;
		display: grid;
		gap: 2px;
		padding: 12px 38px 12px 16px;
		border-block-end: 1px solid var(--color-line);
		color: var(--color-ink);
		text-decoration: none;
		transition: background 150ms var(--ease);
	}
	.rail__list li:last-child .rail__item {
		border-block-end: none;
	}
	.rail__item:hover {
		background: var(--color-panel-subtle);
	}
	.rail__item--primary {
		background: var(--color-green-soft);
	}
	.rail__item--primary:hover {
		background: var(--color-green-soft);
		filter: brightness(0.98);
	}
	.rail__label {
		font-size: 0.9rem;
		font-weight: 500;
	}
	.rail__item--primary .rail__label {
		color: var(--color-green-dark);
	}
	.rail__desc {
		font-size: 0.8rem;
		color: var(--color-ink-soft);
	}
	.rail__chev {
		position: absolute;
		inset-inline-end: 16px;
		inset-block-start: 50%;
		transform: translateY(-50%);
		color: var(--color-ink-faint);
		transition: transform 150ms var(--ease);
	}
	.rail__item:hover .rail__chev {
		transform: translate(3px, -50%);
		color: var(--color-act);
	}
</style>
