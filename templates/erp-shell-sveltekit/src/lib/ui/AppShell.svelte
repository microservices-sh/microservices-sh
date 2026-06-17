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
	onMount(() => {
		theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
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

<div class="as-shell">
	<aside class="as-side">
		<Logo href={brandHref} class="as-side-brand" />

		<nav class="as-nav" aria-label="Primary">
			{#each nav as group, i (group.section ?? i)}
				<div class="as-nav-group">
					{#if group.section}<div class="as-nav-title">{group.section}</div>{/if}
					{#each group.items as item (item.href)}
						<a href={item.href} aria-current={item.href === activeHref ? 'page' : undefined}>
							<span class="as-nav-dot" aria-hidden="true"></span>{item.label}
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
		display: grid;
		grid-template-columns: 232px minmax(0, 1fr);
		min-block-size: 100dvh;
		inline-size: 100%;
		margin: 0;
		padding-block-end: var(--statusbar-h, 0px);
	}
	.as-side {
		display: flex;
		flex-direction: column;
		gap: 22px;
		border-inline-end: 1px solid var(--color-line);
		background: var(--color-panel-subtle);
		padding: 22px 14px;
		position: sticky;
		top: 0;
		block-size: calc(100dvh - var(--statusbar-h, 0px));
	}
	:global(.as-side-brand) {
		padding-inline: 6px;
	}
	.as-nav {
		display: grid;
		gap: 18px;
	}
	.as-nav-group {
		display: grid;
		gap: 2px;
	}
	.as-nav-title {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-ink-faint);
		padding: 0 9px 6px;
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
	.as-nav-dot {
		inline-size: 8px;
		aspect-ratio: 1;
		border-radius: 2px;
		background: var(--color-line-strong);
	}
	.as-nav a[aria-current='page'] .as-nav-dot {
		background: var(--color-act);
	}
	.as-side-foot {
		margin-block-start: auto;
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
		padding: 32px 28px 56px;
		max-inline-size: 1180px;
		inline-size: 100%;
	}
	.as-statusbar {
		position: fixed;
		inset-block-end: 0;
		inset-inline: 0;
		z-index: 20;
		block-size: var(--statusbar-h, 30px);
		display: flex;
		align-items: center;
		padding-inline: 14px;
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
		block-size: 100%;
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
			overflow-x: auto;
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
			gap: 6px;
		}
		.as-nav-group {
			display: flex;
			flex-direction: row;
			gap: 6px;
		}
		.as-nav-title,
		.as-side-foot {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.as-topbar,
		.as-statusbar {
			backdrop-filter: none;
		}
	}
</style>
