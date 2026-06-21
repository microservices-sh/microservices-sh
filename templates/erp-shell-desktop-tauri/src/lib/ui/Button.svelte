<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'ghost' | 'success';
	type Size = 'md' | 'sm';

	interface Props {
		href?: string;
		variant?: Variant;
		size?: Size;
		type?: 'button' | 'submit';
		disabled?: boolean;
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	}

	let {
		href,
		variant = 'ghost',
		size = 'md',
		type = 'button',
		disabled = false,
		class: cls = '',
		children,
		...rest
	}: Props = $props();
</script>

{#if href}
	<a {href} class="btn btn--{variant} btn--{size} {cls}" {...rest}>
		<span class="btn__label">{@render children()}</span>
	</a>
{:else}
	<button {type} {disabled} class="btn btn--{variant} btn--{size} {cls}" {...rest}>
		<span class="btn__label">{@render children()}</span>
	</button>
{/if}

<style>
	.btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		isolation: isolate;
		overflow: hidden;
		cursor: pointer;
		white-space: nowrap;
		/* Explicit so a consumer's global `button`/`.button` element rule (e.g. an
		   app.css that sets py-[0.7rem]) can't leak vertical padding and inflate
		   the height — the size is owned by min-block-size below. */
		padding-block: 0;
		margin: 0;
		box-sizing: border-box;
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-md);
		background: var(--color-panel);
		color: var(--color-ink);
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 0.9rem;
		letter-spacing: 0;
		text-decoration: none;
		box-shadow: var(--shadow-sm);
		transition:
			transform 250ms var(--ease),
			box-shadow 300ms var(--ease),
			background 250ms var(--ease),
			border-color 250ms var(--ease),
			color 250ms var(--ease);
	}
	.btn--md {
		min-block-size: 38px;
		padding-inline: 14px;
	}
	.btn--sm {
		min-block-size: 32px;
		padding-inline: 11px;
		font-size: 0.82rem;
	}
	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.btn:any-link,
	.btn:any-link:hover,
	.btn:any-link:focus-visible {
		color: var(--color-ink);
		text-decoration: none;
	}
	.btn:focus-visible {
		outline: 2px solid var(--color-act);
		outline-offset: 2px;
		box-shadow: var(--focus-ring);
	}

	.btn__label {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	/* ghost (default) */
	.btn--ghost:hover {
		border-color: var(--color-green-dark);
		color: var(--color-green-dark);
		transform: translateY(-1px);
		box-shadow: var(--shadow-card);
	}
	.btn--ghost:any-link:hover,
	.btn--ghost:any-link:focus-visible {
		color: var(--color-green-dark);
	}
	.btn--ghost:active {
		transform: translateY(0);
		box-shadow: var(--shadow-sm);
	}

	/* primary / success — brand green, light-mode tuned */
	.btn--primary,
	.btn--success {
		border-color: transparent;
		background: var(--color-act);
		color: #fff;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.14),
			0 1px 2px rgba(8, 60, 38, 0.18),
			0 1px 1px rgba(16, 24, 40, 0.04);
	}
	.btn--primary:hover,
	.btn--success:hover {
		background: var(--color-act-hover);
		color: #fff;
		transform: translateY(-1px);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.16),
			0 6px 16px -8px rgba(10, 122, 75, 0.5),
			0 2px 4px rgba(8, 60, 38, 0.14);
	}
	.btn--primary:any-link,
	.btn--primary:any-link:hover,
	.btn--primary:any-link:focus-visible,
	.btn--success:any-link,
	.btn--success:any-link:hover,
	.btn--success:any-link:focus-visible {
		color: #fff;
	}
	.btn--primary:active,
	.btn--success:active {
		transform: translateY(0);
		background: var(--color-act-press);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18);
	}

	/* restrained sheen — brand signature */
	.btn--primary::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		background: linear-gradient(
			110deg,
			transparent 30%,
			rgba(255, 255, 255, 0.22) 50%,
			transparent 70%
		);
		transform: translateX(-120%);
		transition: transform 650ms var(--ease);
		pointer-events: none;
	}
	.btn--primary:hover::before {
		transform: translateX(120%);
	}

	@media (prefers-reduced-motion: reduce) {
		.btn {
			transition: none;
		}
		.btn--primary::before {
			display: none;
		}
	}
</style>
