<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import Logo from './Logo.svelte';
	import Button from './Button.svelte';

	// The canonical internal-app chrome (web-portal / admin look): a 232px sidebar
	// with grouped nav + section titles + active dots, a sticky topbar with a
	// built-in theme toggle, and an optional status bar. App-specific content is
	// passed in; the structure + styling are fixed so every app matches.
	//
	// All internal classes are namespaced `as-*` so they can't collide with the
	// consuming app's global CSS (a generic `.shell`/`.nav`/`.topbar` in app.css
	// would otherwise cascade in — e.g. a centered max-width container).
	interface NavItem {
		href: string;
		label: string;
		icon?: string;
	}
	interface NavGroup {
		section?: string;
		items: NavItem[];
	}

	interface Props {
		nav: NavGroup[];
		pathname: string;
		brandHref?: string;
		footer?: { title?: string; subtitle?: string };
		crumbs?: Snippet;
		actions?: Snippet;
		status?: { role?: string; center?: string; right?: string };
		children: Snippet;
	}

	let { nav, pathname, brandHref = '/', footer, crumbs, actions, status, children }: Props = $props();

	// Most-specific match wins so a root entry (e.g. /app) doesn't stay highlighted
	// on nested routes.
	const activeHref = $derived(
		nav
			.flatMap((g) => g.items.map((i) => i.href))
			.filter((h) => pathname === h || pathname.startsWith(h + '/'))
			.sort((a, b) => b.length - a.length)[0] ?? null
	);

	let theme = $state<'light' | 'dark'>('light');
	let mounted = $state(false);
	let collapsed = $state<Set<string>>(new Set());

	// Lucide-style stroke icons (inner SVG; rendered inside a shared <svg>).
	const ICONS: Record<string, string> = {
		dashboard:
			'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
		bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
		bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
		users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
		calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
		'life-buoy':
			'<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
		'file-text':
			'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
		'credit-card': '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
		receipt:
			'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
		image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
		megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
		'message-square':
			'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
		clipboard:
			'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
		'clipboard-list':
			'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M8 11h8"/><path d="M8 16h8"/>',
		workflow: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
		webhook:
			'<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>',
		folder:
			'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
		settings:
			'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
		shield:
			'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
		dot: '<circle cx="12" cy="12" r="3.5"/>'
	};

	function toggleGroup(section: string | undefined) {
		if (!section) return;
		const next = new Set(collapsed);
		next.has(section) ? next.delete(section) : next.add(section);
		collapsed = next;
		try {
			localStorage.setItem('erp-nav-collapsed', JSON.stringify([...next]));
		} catch (e) {
			/* private mode */
		}
	}
	const isCollapsed = (section: string | undefined) => (section ? collapsed.has(section) : false);

	function scrollActiveNavIntoView() {
		if (!window.matchMedia('(max-width: 860px)').matches) return;
		document
			.querySelector('.as-nav a[aria-current="page"]')
			?.scrollIntoView({ block: 'nearest', inline: 'center' });
	}

	onMount(() => {
		theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
		try {
			const raw = localStorage.getItem('erp-nav-collapsed');
			if (raw) collapsed = new Set(JSON.parse(raw) as string[]);
		} catch (e) {
			/* private mode */
		}
		mounted = true;
	});

	$effect(() => {
		activeHref;
		if (!mounted) return;
		requestAnimationFrame(scrollActiveNavIntoView);
	});

	function toggleTheme() {
		const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = n;
		try {
			localStorage.setItem('theme', n);
		} catch (e) {
			/* private mode */
		}
		theme = n;
	}
</script>

<div class="as-shell" class:has-status={Boolean(status)}>
	<aside class="as-side">
		<Logo href={brandHref} class="as-side-brand" />

		<nav class="as-nav" aria-label="Primary">
			{#each nav as group, i (group.section ?? i)}
				<div class="as-nav-group" class:is-collapsed={isCollapsed(group.section)}>
					{#if group.section}
						<button
							type="button"
							class="as-nav-title"
							aria-expanded={!isCollapsed(group.section)}
							onclick={() => toggleGroup(group.section)}
						>
							<span>{group.section}</span>
							<svg
								class="as-nav-chev"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
						</button>
					{/if}
					{#each group.items as item (item.href)}
						<a class="as-nav-item" href={item.href} aria-current={item.href === activeHref ? 'page' : undefined}>
							<span class="as-nav-ico" aria-hidden="true">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{@html ICONS[item.icon ?? 'dot'] ?? ICONS.dot}</svg>
							</span>{item.label}
						</a>
					{/each}
				</div>
			{/each}
		</nav>

		{#if footer}
			<div class="as-side-foot">
				{#if footer.title}<div class="as-ws">{footer.title}</div>{/if}
				{#if footer.subtitle}<div class="as-ws-sub">{footer.subtitle}</div>{/if}
			</div>
		{/if}
	</aside>

	<div class="as-main">
		<header class="as-topbar">
			<div class="as-crumbs">{#if crumbs}{@render crumbs()}{/if}</div>
			<div class="as-actions">
				<Button
					variant="ghost"
					size="sm"
					onclick={toggleTheme}
					aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
				>
					{theme === 'dark' ? '☀' : '☾'}
				</Button>
				{#if actions}{@render actions()}{/if}
			</div>
		</header>

		<main class="as-content">
			{@render children()}
		</main>
	</div>
</div>

{#if status}
	<footer class="as-statusbar" aria-label="Status bar">
		{#if status.role}<span class="as-seg as-branch"><span class="as-led" aria-hidden="true"></span>{status.role}</span>{/if}
		{#if status.center}<span class="as-seg">{status.center}</span>{/if}
		{#if status.right}<span class="as-seg as-push">{status.right}</span>{/if}
	</footer>
{/if}

<style>
	.as-shell {
		--statusbar-h: 0px;
		display: grid;
		grid-template-columns: 232px minmax(0, 1fr);
		min-block-size: 100dvh;
		inline-size: 100%;
		margin: 0;
	}
	.as-shell.has-status {
		/* Reserve the fixed status bar's height so the sidebar ends just above it
		   and page content clears it (consumed by --statusbar-h below). */
		--statusbar-h: 30px;
	}
	.as-side {
		display: flex;
		flex-direction: column;
		gap: 16px;
		border-inline-end: 1px solid var(--color-line);
		background: var(--color-panel-subtle);
		padding: 22px 14px;
		position: sticky;
		top: 0;
		block-size: calc(100dvh - var(--statusbar-h, 0px));
		/* Pin the brand + footer; only the nav region between them scrolls. */
		overflow: hidden;
	}
	:global(.as-side-brand) {
		flex: none;
		padding-inline: 6px;
	}
	.as-nav {
		display: grid;
		align-content: start;
		gap: 18px;
		/* Grow to fill the gap between brand and footer, and scroll a long module
		   list rather than overflowing the fixed-height sidebar. */
		flex: 1 1 auto;
		min-block-size: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		/* Hold the scrollbar flush to the panel edge without crowding labels. */
		margin-inline-end: -8px;
		padding-inline-end: 8px;
		scrollbar-width: thin;
		scrollbar-color: var(--color-line-strong) transparent;
	}
	.as-nav::-webkit-scrollbar {
		inline-size: 8px;
	}
	.as-nav::-webkit-scrollbar-thumb {
		background: var(--color-line-strong);
		border-radius: 99px;
		border: 2px solid transparent;
		background-clip: padding-box;
	}
	.as-nav::-webkit-scrollbar-thumb:hover {
		background: var(--color-ink-faint);
		background-clip: padding-box;
	}
	.as-nav::-webkit-scrollbar-track {
		background: transparent;
	}
	.as-nav-group {
		display: grid;
		gap: 2px;
	}
	/* Group header doubles as a collapse toggle. It must stay a quiet label, so we
	   explicitly neutralize the app's global <button> utility styling (background,
	   shadow, lift, min-height) — otherwise button:hover adds a "card" on hover. */
	.as-nav-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		inline-size: 100%;
		min-block-size: 0;
		margin: 0;
		padding: 0 9px 6px;
		border: 0;
		background: none;
		box-shadow: none;
		transform: none;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-ink-faint);
		cursor: pointer;
		transition: color 150ms var(--ease);
	}
	.as-nav-title:hover,
	.as-nav-title:active {
		color: var(--color-ink-soft);
		background: none;
		box-shadow: none;
		transform: none;
	}
	.as-nav-chev {
		inline-size: 13px;
		block-size: 13px;
		flex: none;
		opacity: 0.6;
		transition: transform 180ms var(--ease);
	}
	.as-nav-group.is-collapsed .as-nav-chev {
		transform: rotate(-90deg);
	}
	.as-nav-group.is-collapsed .as-nav-item {
		display: none;
	}
	.as-nav a {
		display: flex;
		align-items: center;
		gap: 9px;
		min-block-size: 32px;
		padding-inline: 9px;
		border-radius: var(--radius-sm);
		color: var(--color-ink-soft);
		font-size: 0.875rem;
		text-decoration: none;
	}
	.as-nav a:hover {
		background: var(--color-panel);
		color: var(--color-ink);
	}
	.as-nav a[aria-current='page'] {
		color: var(--color-ink);
		background: var(--color-panel);
		border: 1px solid var(--color-line);
		box-shadow: var(--shadow-sm);
	}
	.as-nav-ico {
		display: grid;
		place-items: center;
		inline-size: 18px;
		block-size: 18px;
		flex: none;
		color: var(--color-ink-faint);
		transition: color 150ms var(--ease);
	}
	.as-nav-ico svg {
		inline-size: 16px;
		block-size: 16px;
	}
	.as-nav a:hover .as-nav-ico,
	.as-nav a[aria-current='page'] .as-nav-ico {
		color: var(--color-act);
	}
	.as-side-foot {
		flex: none;
		padding: 10px 9px 0;
		border-block-start: 1px solid var(--color-line);
	}
	.as-ws {
		font-size: 0.84rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.as-ws-sub {
		font-size: 0.74rem;
		color: var(--color-ink-faint);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.as-main {
		display: flex;
		flex-direction: column;
		min-inline-size: 0;
	}
	.as-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 0 28px;
		min-block-size: 56px;
		border-block-end: 1px solid var(--color-line);
		background: color-mix(in srgb, var(--color-paper) 70%, transparent);
		backdrop-filter: blur(8px);
		position: sticky;
		top: 0;
		z-index: 5;
	}
	.as-crumbs {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-inline-size: 0;
	}
	.as-crumbs :global(.mono) {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--color-ink-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.as-actions {
		display: inline-flex;
		align-items: center;
		gap: 12px;
	}
	.as-content {
		padding: 32px 28px calc(56px + var(--statusbar-h));
		max-inline-size: 1180px;
		inline-size: 100%;
	}
	.as-statusbar {
		/* Always-visible bottom status bar (its height is reserved by
		   --statusbar-h, so it never covers content or the sidebar footer). */
		position: fixed;
		inset-inline: 0;
		inset-block-end: 0;
		z-index: 20;
		min-block-size: 30px;
		block-size: auto;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		row-gap: 4px;
		padding-inline: 14px;
		padding-block: 6px;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--color-ink-soft);
		background: color-mix(in srgb, var(--color-paper) 86%, transparent);
		backdrop-filter: blur(8px);
		border-block-start: 1px solid var(--color-line);
	}
	.as-seg {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding-inline: 12px;
		min-block-size: 22px;
		block-size: auto;
		border-inline-end: 1px solid var(--color-line);
	}
	.as-seg:first-child {
		padding-inline-start: 0;
	}
	.as-push {
		margin-inline-start: auto;
		border-inline-end: 0;
		border-inline-start: 1px solid var(--color-line);
		color: var(--color-ink-faint);
	}
	.as-branch {
		color: var(--color-ink);
	}
	.as-led {
		inline-size: 7px;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--color-green);
		box-shadow: 0 0 0 3px rgba(21, 176, 121, 0.16);
	}
	@media (max-width: 860px) {
		.as-shell {
			grid-template-columns: 1fr;
		}
		.as-side {
			position: sticky;
			inset-block-start: 0;
			z-index: 6;
			block-size: auto;
			flex-direction: row;
			align-items: center;
			gap: 10px;
			padding: 10px 14px;
			overflow-x: hidden;
			scrollbar-width: none;
			border-inline-end: 0;
			border-block-end: 1px solid var(--color-line);
			background: color-mix(in srgb, var(--color-paper) 88%, transparent);
			backdrop-filter: blur(8px);
		}
		.as-side::-webkit-scrollbar {
			display: none;
		}
		.as-side :global(.as-side-brand) {
			flex: none;
		}
		.as-nav {
			display: flex;
			flex-direction: row;
			flex: 1 1 auto;
			gap: 6px;
			min-inline-size: 0;
			margin-inline-end: 0;
			padding-inline-end: 0;
			overflow-x: auto;
			overflow-y: hidden;
			scrollbar-width: none;
		}
		.as-nav::-webkit-scrollbar {
			display: none;
		}
		.as-nav-group {
			display: flex;
			flex-direction: row;
			flex: none;
			gap: 6px;
		}
		.as-nav-title,
		.as-side-foot {
			display: none;
		}
		/* Collapse is a desktop affordance; the horizontal mobile nav always shows
		   every item even if a group was collapsed on desktop. */
		.as-nav-group.is-collapsed .as-nav-item {
			display: flex;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.as-topbar,
		.as-statusbar {
			backdrop-filter: none;
		}
	}
</style>
