<script lang="ts">
	interface Props {
		height?: number;
		withWordmark?: boolean;
		href?: string | null;
		class?: string;
	}

	let { height = 26, withWordmark = true, href = '/', class: cls = '' }: Props = $props();
</script>

{#snippet markSvg()}
	<svg
		class="logo__mark"
		width={height}
		height={height}
		viewBox="0 0 40 40"
		fill="none"
		aria-hidden="true"
	>
		<defs>
			<linearGradient id="hexfill-light" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
				<stop offset="0" stop-color="rgba(12,143,90,0.12)" />
				<stop offset="1" stop-color="rgba(12,143,90,0.015)" />
			</linearGradient>
		</defs>
		<!-- flat-top hexagon "shell" cell -->
		<path
			d="M11 4.5h18l9 15.5-9 15.5H11L2 20Z"
			fill="url(#hexfill-light)"
			stroke="var(--color-ink)"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
		<!-- prompt chevron -->
		<path
			d="M14 14.5l5.5 5.5L14 25.5"
			stroke="var(--color-act)"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<!-- cursor underscore (blinks like a live terminal caret) -->
		<rect class="logo__cursor" x="22" y="24" width="6" height="2.4" rx="1.2" fill="var(--color-act)" />
	</svg>
{/snippet}

{#snippet wordmarkSnippet()}
	<span class="logo__word">microservices<span class="logo__tld">.sh</span></span>
{/snippet}

{#if href}
	<a {href} class="logo {cls}" aria-label="microservices.sh home">
		{@render markSvg()}
		{#if withWordmark}{@render wordmarkSnippet()}{/if}
	</a>
{:else}
	<span class="logo {cls}">
		{@render markSvg()}
		{#if withWordmark}{@render wordmarkSnippet()}{/if}
	</span>
{/if}

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		flex: none;
		color: inherit;
		text-decoration: none;
	}
	.logo:hover,
	.logo:focus-visible {
		text-decoration: none;
	}
	.logo__mark {
		flex: none;
		transition:
			transform 0.4s var(--ease),
			filter 0.4s var(--ease);
	}
	.logo:hover .logo__mark {
		transform: rotate(-6deg) scale(1.04);
		filter: drop-shadow(0 2px 6px rgba(12, 143, 90, 0.28));
	}

	/* idle micro-motion: terminal caret blink */
	.logo__cursor {
		transform-box: fill-box;
		transform-origin: center;
		animation: logo-blink 1.25s steps(1, end) infinite;
	}
	@keyframes logo-blink {
		0%,
		58% {
			opacity: 1;
		}
		60%,
		100% {
			opacity: 0;
		}
	}
	.logo:hover .logo__cursor {
		animation-duration: 0.7s;
	}
	.logo__word {
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 1rem;
		letter-spacing: 0;
		color: var(--color-ink);
	}
	.logo__tld {
		font-family: var(--font-mono);
		font-weight: 500;
		letter-spacing: 0;
		color: var(--color-act);
	}
	@media (prefers-reduced-motion: reduce) {
		.logo__mark {
			transition: none;
		}
		.logo__cursor {
			animation: none;
			opacity: 1;
		}
	}
</style>
