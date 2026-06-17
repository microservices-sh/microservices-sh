<script lang="ts">
	// `$app/stores` navigating store works across SvelteKit 2.9 (templates) and
	// 2.63 (web-portal/admin) — unlike `$app/state`, which only exists in newer
	// SvelteKit. Keep this for cross-repo portability.
	import { navigating } from '$app/stores';

	const active = $derived(Boolean($navigating));
</script>

{#if active}
	<div class="navprogress" role="status" aria-label="Loading">
		<div class="navprogress__bar"></div>
	</div>
{/if}

<style>
	.navprogress {
		position: fixed;
		inset-block-start: 0;
		inset-inline: 0;
		z-index: 100;
		block-size: 2px;
		background: color-mix(in srgb, var(--color-act) 16%, transparent);
		overflow: hidden;
	}
	.navprogress__bar {
		block-size: 100%;
		inline-size: 40%;
		border-radius: 99px;
		background: linear-gradient(90deg, transparent, var(--color-act), transparent);
		animation: slide 1s var(--ease) infinite;
	}
	@keyframes slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(320%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.navprogress__bar {
			inline-size: 100%;
			animation: pulse 1.2s ease-in-out infinite;
		}
		@keyframes pulse {
			0%,
			100% {
				opacity: 0.4;
			}
			50% {
				opacity: 1;
			}
		}
	}
</style>
