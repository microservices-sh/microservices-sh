<script lang="ts">
	type AgentAvatarState = 'idle' | 'active';

	type Palette = {
		bg: string;
		body: string;
		shade: string;
		ink: string;
		accent: string;
		prop: string;
		propLight: string;
	};

	interface Props {
		slug?: string;
		size?: number;
		state?: AgentAvatarState;
		label?: string | null;
		class?: string;
	}

	const palettes: Record<string, Palette> = {
		'sales-triage': {
			bg: '#F5EEFF',
			body: '#C9B4F4',
			shade: '#A98AE2',
			ink: '#1F1339',
			accent: '#FF7BA8',
			prop: '#1F1339',
			propLight: '#FFFFFF'
		},
		support: {
			bg: '#E6FAF4',
			body: '#8FE4CC',
			shade: '#5CC2A8',
			ink: '#0E3A2B',
			accent: '#FF8CA5',
			prop: '#0E3A2B',
			propLight: '#FFFFFF'
		},
		operations: {
			bg: '#FFF4E0',
			body: '#F5C98B',
			shade: '#E0A85C',
			ink: '#4A2506',
			accent: '#FF7E6B',
			prop: '#4A2506',
			propLight: '#FFFFFF'
		},
		bookkeeper: {
			bg: '#E9F1E5',
			body: '#A9D494',
			shade: '#7EB56A',
			ink: '#1F3A13',
			accent: '#FF8CA5',
			prop: '#1F3A13',
			propLight: '#FFFFFF'
		},
		content: {
			bg: '#FFEEF4',
			body: '#F7A9BF',
			shade: '#E07D97',
			ink: '#4E0A24',
			accent: '#FFE07D',
			prop: '#4E0A24',
			propLight: '#FFFFFF'
		},
		reception: {
			bg: '#E5F4FF',
			body: '#9BC9F2',
			shade: '#6BA4DC',
			ink: '#0A2A55',
			accent: '#FF7BA8',
			prop: '#0A2A55',
			propLight: '#FFFFFF'
		},
		'nightly-digest': {
			bg: '#E9E8F5',
			body: '#B5B0E8',
			shade: '#8982CF',
			ink: '#130C3A',
			accent: '#FFD66B',
			prop: '#130C3A',
			propLight: '#FFFFFF'
		},
		custom: {
			bg: '#F3F3F5',
			body: '#E8E6EE',
			shade: '#C4C1D3',
			ink: '#2C2840',
			accent: '#8B5CF6',
			prop: '#2C2840',
			propLight: '#FFFFFF'
		}
	};

	let {
		slug = 'custom',
		size = 96,
		state = 'idle',
		label = null,
		class: cls = ''
	}: Props = $props();

	const palette = $derived(palettes[slug] ?? palettes.custom);
	const safeSlug = $derived(slug.replace(/[^a-z0-9_-]/gi, '-'));
	const hash = $derived([...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0));
	const blinkDelay = $derived((hash % 40) / 10);
	const bobDelay = $derived((hash % 25) / 10);
</script>

<span
	class="agent-avatar {state === 'active' ? 'is-active' : ''} {cls}"
	style:width={`${size}px`}
	style:height={`${size}px`}
	style:--blink-delay={`${blinkDelay}s`}
	style:--bob-delay={`${bobDelay}s`}
	data-slug={slug}
>
	<svg
		viewBox="0 0 96 96"
		xmlns="http://www.w3.org/2000/svg"
		role={label ? 'img' : undefined}
		aria-label={label ?? undefined}
		aria-hidden={label ? undefined : 'true'}
	>
		<defs>
			<radialGradient id={`agent-bg-${safeSlug}`} cx="32%" cy="28%" r="85%">
				<stop offset="0%" stop-color={palette.bg} />
				<stop offset="100%" stop-color={palette.bg} stop-opacity="0.55" />
			</radialGradient>
			<linearGradient id={`agent-body-${safeSlug}`} x1="0" x2="0" y1="0" y2="1">
				<stop offset="0%" stop-color={palette.body} />
				<stop offset="100%" stop-color={palette.shade} />
			</linearGradient>
		</defs>

		<circle cx="48" cy="48" r="46" fill={`url(#agent-bg-${safeSlug})`} />

		<g class="bean-group">
			<ellipse cx="48" cy="82" rx="18" ry="2.5" fill={palette.ink} opacity="0.08" />

			<g class="bean-body">
				<path
					d="M24 52 Q24 24 48 24 Q72 24 72 52 Q72 78 48 78 Q24 78 24 52 Z"
					fill={`url(#agent-body-${safeSlug})`}
				/>

				<ellipse cx="38" cy="36" rx="9" ry="6" fill="#FFFFFF" opacity="0.35" />
				<ellipse cx="24" cy="58" rx="4" ry="5" fill={palette.shade} />
				<ellipse cx="72" cy="58" rx="4" ry="5" fill={palette.shade} />
				<ellipse cx="40" cy="78" rx="5" ry="3" fill={palette.shade} />
				<ellipse cx="56" cy="78" rx="5" ry="3" fill={palette.shade} />
				<circle cx="32" cy="52" r="4" fill={palette.accent} opacity="0.45" />
				<circle cx="64" cy="52" r="4" fill={palette.accent} opacity="0.45" />

				<g class="eyes">
					<g>
						<ellipse cx="40" cy="46" rx="3.2" ry="4" fill={palette.ink} />
						<circle cx="41.2" cy="44.6" r="1.1" fill="#FFFFFF" />
					</g>
					<g>
						<ellipse cx="56" cy="46" rx="3.2" ry="4" fill={palette.ink} />
						<circle cx="57.2" cy="44.6" r="1.1" fill="#FFFFFF" />
					</g>
				</g>

				{#if slug === 'operations' || slug === 'nightly-digest' || slug === 'custom'}
					<line x1="45" y1={slug === 'custom' ? '56' : '57'} x2="51" y2={slug === 'custom' ? '56' : '57'} stroke={palette.ink} stroke-width="1.8" stroke-linecap="round" />
				{:else if slug === 'content'}
					<ellipse cx="48" cy="57" rx="2" ry="2.2" fill={palette.ink} />
				{:else}
					<path d="M43 55 Q48 60 53 55" stroke={palette.ink} stroke-width="1.8" stroke-linecap="round" fill="none" />
				{/if}
			</g>

			{#if slug === 'sales-triage'}
				<g class="sig-sales">
					<path d="M28 40 Q28 20 48 20 Q68 20 68 40" stroke={palette.prop} stroke-width="3" fill="none" stroke-linecap="round" />
					<rect x="24" y="38" width="8" height="10" rx="3" fill={palette.prop} />
					<rect x="64" y="38" width="8" height="10" rx="3" fill={palette.prop} />
					<circle cx="32" cy="43" r="1.5" fill={palette.accent} />
					<path d="M32 48 Q28 55 36 57" stroke={palette.prop} stroke-width="2" fill="none" stroke-linecap="round" />
					<circle cx="36" cy="57" r="2" fill={palette.accent} />
					<g class="signal" fill="none" stroke={palette.accent} stroke-width="1.5" stroke-linecap="round">
						<path d="M80 24 Q84 26 84 32" />
						<path d="M84 20 Q90 24 90 34" />
					</g>
				</g>
			{:else if slug === 'support'}
				<g class="sig-support">
					<path d="M72 16 Q82 16 82 26 Q82 34 74 34 L70 40 L70 34 Q64 32 64 26 Q64 16 72 16 Z" fill={palette.prop} />
					<path d="M70 22 Q72 20 73 22 Q74 20 76 22 Q76 26 73 28 Q70 26 70 22 Z" fill={palette.accent} />
				</g>
			{:else if slug === 'operations'}
				<g class="sig-ops">
					<path d="M28 20 Q48 8 68 20 Q68 24 48 24 Q28 24 28 20 Z" fill={palette.prop} />
					<circle cx="66" cy="14" r="2" fill={palette.accent} />
					<rect x="38" y="58" width="20" height="16" rx="2" fill={palette.propLight} stroke={palette.prop} stroke-width="1.5" />
					<rect x="42" y="56" width="12" height="4" rx="1.5" fill={palette.prop} />
					<line x1="41" y1="64" x2="55" y2="64" stroke={palette.prop} stroke-width="1" stroke-linecap="round" />
					<line x1="41" y1="67" x2="52" y2="67" stroke={palette.prop} stroke-width="1" stroke-linecap="round" />
					<line x1="41" y1="70" x2="54" y2="70" stroke={palette.prop} stroke-width="1" stroke-linecap="round" />
				</g>
			{:else if slug === 'bookkeeper'}
				<g class="sig-book">
					<g class="glasses">
						<circle cx="40" cy="46" r="6" fill="none" stroke={palette.prop} stroke-width="2" />
						<circle cx="56" cy="46" r="6" fill="none" stroke={palette.prop} stroke-width="2" />
						<line x1="46" y1="46" x2="50" y2="46" stroke={palette.prop} stroke-width="2" />
						<path d="M36 43 Q38 41 41 41" stroke="#FFFFFF" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.8" />
						<path d="M52 43 Q54 41 57 41" stroke="#FFFFFF" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.8" />
					</g>
					<g class="ledger">
						<rect x="74" y="56" width="12" height="10" rx="1.5" fill={palette.prop} />
						<rect x="74" y="56" width="6" height="10" fill={palette.shade} opacity="0.3" />
						<line x1="80" y1="56" x2="80" y2="66" stroke={palette.propLight} stroke-width="0.8" />
					</g>
				</g>
			{:else if slug === 'content'}
				<g class="sig-content">
					<g class="sprout">
						<path d="M48 22 Q42 14 38 18 Q40 24 48 24 Z" fill={palette.shade} />
						<path d="M48 22 Q54 12 58 18 Q54 24 48 24 Z" fill={palette.body} />
						<line x1="48" y1="24" x2="48" y2="18" stroke={palette.ink} stroke-width="1.2" />
					</g>
					<g class="pen">
						<rect x="72" y="38" width="3" height="16" rx="1" fill={palette.prop} transform="rotate(30 73.5 46)" />
						<polygon points="79,34 81,36 77,38" fill={palette.accent} />
					</g>
				</g>
			{:else if slug === 'reception'}
				<g class="sig-reception">
					<g class="wave">
						<rect x="69" y="38" width="8" height="4" rx="2" fill={palette.shade} transform="rotate(-25 73 40)" />
						<circle cx="80" cy="32" r="4" fill={palette.shade} />
						<circle cx="82" cy="30" r="1" fill={palette.shade} />
						<circle cx="83" cy="33" r="1" fill={palette.shade} />
					</g>
					<g class="bell">
						<path d="M12 72 Q12 62 20 62 Q28 62 28 72 Z" fill={palette.prop} />
						<rect x="10" y="72" width="20" height="2.5" rx="1" fill={palette.prop} />
						<circle cx="20" cy="60" r="1.8" fill={palette.accent} />
					</g>
				</g>
			{:else if slug === 'nightly-digest'}
				<g class="sig-night">
					<path d="M30 28 Q48 8 68 28 Q64 34 48 30 Q32 34 30 28 Z" fill={palette.prop} />
					<circle cx="70" cy="18" r="3" fill={palette.propLight} />
					<g class="moon">
						<path d="M78 44 A7 7 0 1 0 84 54 A5.5 5.5 0 1 1 78 44 Z" fill={palette.accent} />
					</g>
					<g class="zzz" fill={palette.prop} font-family="sans-serif" font-size="7" font-weight="700">
						<text x="76" y="30">z</text>
						<text x="82" y="24">z</text>
					</g>
				</g>
			{:else if slug === 'custom'}
				<g class="sig-custom">
					<path
						d="M24 52 Q24 24 48 24 Q72 24 72 52 Q72 78 48 78 Q24 78 24 52 Z"
						fill="none"
						stroke={palette.accent}
						stroke-width="2"
						stroke-dasharray="4 4"
					/>
					<text x="48" y="52" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="800" fill={palette.accent}>+</text>
				</g>
			{/if}
		</g>
	</svg>
</span>

<style>
	.agent-avatar {
		display: inline-block;
		position: relative;
		line-height: 0;
		flex: none;
	}
	.agent-avatar svg {
		width: 100%;
		height: 100%;
		display: block;
		overflow: visible;
	}
	.bean-group {
		animation: avatar-bob 3.8s ease-in-out infinite;
		animation-delay: var(--bob-delay, 0s);
		transform-origin: 50% 85%;
	}
	.agent-avatar.is-active .bean-group {
		animation: avatar-bob-active 2.6s ease-in-out infinite;
	}
	.eyes {
		animation: avatar-blink 5s ease-in-out infinite;
		animation-delay: var(--blink-delay, 0s);
		transform-origin: 50% 46%;
	}
	.agent-avatar.is-active .eyes {
		animation-duration: 3s;
	}
	.agent-avatar[data-slug='content'] .pen {
		animation: avatar-pen 3s ease-in-out infinite;
		transform-origin: 73px 46px;
	}
	.agent-avatar[data-slug='content'] .sprout,
	.agent-avatar[data-slug='operations'] .sig-ops {
		animation: avatar-sway-small 3.4s ease-in-out infinite;
		transform-origin: 48px 24px;
	}
	.agent-avatar[data-slug='operations'] .sig-ops {
		animation-duration: 4.2s;
		transform-origin: 48px 40px;
	}
	.agent-avatar[data-slug='nightly-digest'] .moon,
	.agent-avatar[data-slug='support'] .sig-support,
	.agent-avatar[data-slug='bookkeeper'] .ledger {
		animation: avatar-float 4s ease-in-out infinite;
	}
	.agent-avatar[data-slug='nightly-digest'] .moon {
		animation-duration: 6s;
		transform-origin: 80px 50px;
	}
	.agent-avatar[data-slug='nightly-digest'] .zzz {
		animation: avatar-zzz 2.4s ease-in-out infinite;
		transform-origin: 80px 28px;
	}
	.agent-avatar[data-slug='sales-triage'] .signal {
		animation: avatar-signal 1.8s ease-in-out infinite;
		transform-origin: 84px 28px;
	}
	.agent-avatar[data-slug='reception'] .wave {
		animation: avatar-wave 1.6s ease-in-out infinite;
		transform-origin: 70px 40px;
	}
	.agent-avatar[data-slug='reception'] .bell {
		animation: avatar-bell 4s ease-in-out infinite;
		transform-origin: 20px 72px;
	}
	@keyframes avatar-bob {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-2px) scale(1.01);
		}
	}
	@keyframes avatar-bob-active {
		0%,
		100% {
			transform: translateY(0) rotate(-1deg);
		}
		50% {
			transform: translateY(-3px) rotate(1deg);
		}
	}
	@keyframes avatar-blink {
		0%,
		92%,
		100% {
			transform: scaleY(1);
		}
		94%,
		98% {
			transform: scaleY(0.1);
		}
	}
	@keyframes avatar-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-2px);
		}
	}
	@keyframes avatar-sway-small {
		0%,
		100% {
			transform: rotate(-2deg);
		}
		50% {
			transform: rotate(2deg);
		}
	}
	@keyframes avatar-pen {
		0%,
		100% {
			transform: rotate(0deg);
		}
		50% {
			transform: rotate(-8deg);
		}
	}
	@keyframes avatar-zzz {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		50% {
			transform: translateY(-3px);
			opacity: 1;
		}
	}
	@keyframes avatar-signal {
		0%,
		100% {
			opacity: 0.3;
		}
		50% {
			opacity: 1;
		}
	}
	@keyframes avatar-wave {
		0%,
		100% {
			transform: rotate(-8deg);
		}
		50% {
			transform: rotate(8deg);
		}
	}
	@keyframes avatar-bell {
		0%,
		85%,
		100% {
			transform: rotate(0deg);
		}
		90% {
			transform: rotate(-8deg);
		}
		95% {
			transform: rotate(8deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.agent-avatar * {
			animation: none !important;
		}
	}
</style>
