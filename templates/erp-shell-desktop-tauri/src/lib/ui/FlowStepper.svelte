<script lang="ts">
	// The guided-flow pipeline rail: Connect → Import → Review → Submit. A single
	// horizontal track "fills" with the brand signal-green up to the furthest
	// reached step, the current step glows, and each node carries an optional
	// live count. Nodes are anchors (hash routes), so the rail doubles as
	// primary navigation for the workflow. Setup pages (runtime/settings) live in
	// the sidebar, not here — this rail is only the linear document path.
	export type FlowState = 'done' | 'active' | 'upcoming' | 'blocked';

	export interface FlowStep {
		key: string;
		label: string;
		href: string;
		state: FlowState;
		hint?: string;
		count?: number | null;
	}

	let { steps, current }: { steps: FlowStep[]; current: string } = $props();

	// Fill the connecting track up to the last done/active node so the pipeline
	// reads as "how far the work has travelled".
	const reachedIndex = $derived(
		Math.max(
			0,
			...steps.map((s, i) => (s.state === 'done' || s.state === 'active' ? i : -1))
		)
	);
	const fillPct = $derived(
		steps.length > 1 ? (reachedIndex / (steps.length - 1)) * 100 : 0
	);
</script>

<nav class="flow" aria-label="Document workflow" style={`--flow-fill:${fillPct}%`}>
	<div class="flow-track" aria-hidden="true">
		<span class="flow-track-fill"></span>
	</div>
	<ol class="flow-steps">
		{#each steps as step, i (step.key)}
			<li
				class="flow-step"
				data-state={step.state}
				class:is-current={step.key === current}
			>
				<a class="flow-node" href={step.href} aria-current={step.key === current ? 'step' : undefined}>
					<span class="flow-dot">
						{#if step.state === 'done'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
						{:else if step.state === 'blocked'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="10" x="5" y="11" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
						{:else}
							<span class="flow-index">{i + 1}</span>
						{/if}
					</span>
					<span class="flow-meta">
						<span class="flow-label">{step.label}</span>
						{#if step.hint}<span class="flow-hint">{step.hint}</span>{/if}
					</span>
					{#if step.count != null && step.count > 0}
						<span class="flow-count">{step.count}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.flow {
		position: relative;
		display: block;
		padding: 6px 4px 2px;
	}
	/* The track sits behind the row, vertically centered on the dots. */
	.flow-track {
		position: absolute;
		inset-block-start: calc(6px + 19px);
		inset-inline: calc(4px + 10%);
		block-size: 2px;
		border-radius: 2px;
		background: var(--color-line-strong);
		overflow: hidden;
	}
	.flow-track-fill {
		display: block;
		block-size: 100%;
		inline-size: var(--flow-fill, 0%);
		background: linear-gradient(90deg, var(--color-act), var(--color-green));
		box-shadow: 0 0 8px var(--signal-glow);
		transition: inline-size 480ms var(--ease);
	}
	.flow-steps {
		position: relative;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.flow-node {
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 4px 6px 6px;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-ink-soft);
		transition: transform 180ms var(--ease), background 180ms var(--ease);
	}
	.flow-node:hover {
		background: color-mix(in srgb, var(--color-panel) 70%, transparent);
	}
	.flow-dot {
		display: grid;
		place-items: center;
		inline-size: 38px;
		block-size: 38px;
		border-radius: 50%;
		border: 2px solid var(--color-line-strong);
		background: var(--color-panel);
		color: var(--color-ink-faint);
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.86rem;
		transition: all 220ms var(--ease);
	}
	.flow-dot svg {
		inline-size: 17px;
		block-size: 17px;
	}
	.flow-index {
		line-height: 1;
	}
	.flow-meta {
		display: grid;
		justify-items: center;
		gap: 1px;
		text-align: center;
	}
	.flow-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-ink-soft);
		transition: color 180ms var(--ease);
	}
	.flow-hint {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.02em;
		color: var(--color-ink-faint);
	}
	.flow-count {
		position: absolute;
		inset-block-start: 0;
		inset-inline-end: calc(50% - 30px);
		min-inline-size: 18px;
		block-size: 18px;
		padding-inline: 5px;
		border-radius: 99px;
		background: var(--color-amber);
		color: #fff;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		font-weight: 600;
		line-height: 18px;
		text-align: center;
		box-shadow: var(--shadow-sm);
	}
	.flow-step { position: relative; }

	/* Done: solid green node, bright label. */
	.flow-step[data-state='done'] .flow-dot {
		border-color: var(--color-act);
		background: var(--color-act);
		color: #fff;
	}
	.flow-step[data-state='done'] .flow-label { color: var(--color-ink); }

	/* Active/current: glowing ring, lifted, pulsing. */
	.flow-step.is-current .flow-dot,
	.flow-step[data-state='active'] .flow-dot {
		border-color: var(--color-act);
		background: var(--color-panel);
		color: var(--color-act);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-act) 16%, transparent), 0 0 14px var(--signal-glow);
	}
	.flow-step.is-current .flow-label { color: var(--color-ink); font-weight: 700; }
	.flow-step.is-current .flow-node { transform: translateY(-1px); }
	.flow-step.is-current .flow-dot { animation: flow-pulse 2.4s var(--ease) infinite; }

	/* Blocked: amber-tinted lock, dimmed. */
	.flow-step[data-state='blocked'] .flow-dot {
		border-color: var(--color-amber);
		color: var(--color-amber);
		background: var(--color-amber-soft);
	}

	@keyframes flow-pulse {
		0%, 100% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-act) 16%, transparent), 0 0 12px var(--signal-glow); }
		50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-act) 8%, transparent), 0 0 20px var(--signal-glow); }
	}

	@media (prefers-reduced-motion: reduce) {
		.flow-step.is-current .flow-dot { animation: none; }
		.flow-track-fill { transition: none; }
	}

	@media (max-width: 720px) {
		.flow-hint { display: none; }
		.flow-label { font-size: 0.74rem; }
		.flow-dot { inline-size: 32px; block-size: 32px; }
		.flow-track { inset-block-start: calc(6px + 16px); }
	}
</style>
