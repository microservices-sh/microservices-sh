<script lang="ts">
	import type { TimelineEvent } from "./types";

	// Vertical activity timeline (customer/invoice/ticket history). Events are
	// already ordered newest-first and pre-formatted by the caller.
	let {
		events,
		emptyLabel = "No activity recorded yet."
	}: { events: TimelineEvent[]; emptyLabel?: string } = $props();
</script>

{#if events.length === 0}
	<p class="tl__empty">{emptyLabel}</p>
{:else}
	<ol class="tl">
		{#each events as e, i (i)}
			<li class="tl__item tl__item--{e.tone ?? 'neutral'}">
				<span class="tl__dot" aria-hidden="true"></span>
				<div class="tl__body">
					<div class="tl__head">
						<span class="tl__title">{e.title}</span>
						{#if e.time}<time class="tl__time">{e.time}</time>{/if}
					</div>
					{#if e.detail}<p class="tl__detail">{e.detail}</p>{/if}
				</div>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.tl {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 2px;
	}
	.tl__item {
		position: relative;
		display: grid;
		grid-template-columns: 16px 1fr;
		gap: 12px;
		padding-block: 8px;
		padding-inline-start: 2px;
	}
	/* connector line between dots */
	.tl__item::before {
		content: "";
		position: absolute;
		inset-block: 18px -2px;
		inset-inline-start: 9px;
		inline-size: 1px;
		background: var(--color-line);
	}
	.tl__item:last-child::before {
		display: none;
	}
	.tl__dot {
		position: relative;
		z-index: 1;
		inline-size: 11px;
		block-size: 11px;
		margin-block-start: 4px;
		border-radius: 50%;
		background: var(--color-panel);
		border: 2px solid var(--dot, var(--color-line-strong));
	}
	.tl__item--good {
		--dot: var(--color-green-dark);
	}
	.tl__item--warn {
		--dot: var(--color-amber);
	}
	.tl__item--bad {
		--dot: var(--color-red);
	}
	.tl__item--info {
		--dot: var(--color-cyan);
	}
	.tl__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.tl__title {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-ink);
	}
	.tl__time {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-ink-faint);
	}
	.tl__detail {
		margin: 2px 0 0;
		max-inline-size: none;
		font-size: 0.84rem;
		color: var(--color-ink-soft);
	}
	.tl__empty {
		margin: 0;
		padding: 8px 0;
		font-size: 0.88rem;
		color: var(--color-ink-faint);
	}
</style>
