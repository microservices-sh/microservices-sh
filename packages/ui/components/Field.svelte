<script lang="ts">
	import type { Snippet } from 'svelte';

	// Labeled form control. Pass the input/select/textarea as the default slot
	// and give it the same `id` so the label's `for` associates correctly.
	interface Props {
		label: string;
		id?: string;
		children: Snippet;
	}

	let { label, id, children }: Props = $props();
</script>

<div class="field">
	<label class="field__label" for={id}>{label}</label>
	{@render children()}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-block-end: 14px;
	}
	.field__label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-ink-soft);
	}
	.field :global(input),
	.field :global(select),
	.field :global(textarea) {
		width: 100%;
		min-block-size: 38px;
		padding: 8px 11px;
		border: 1px solid var(--color-line-strong);
		border-radius: var(--radius-md);
		background: var(--color-panel);
		color: var(--color-ink);
		font-family: var(--font-sans);
		font-size: 0.9rem;
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
	}
	.field :global(textarea) {
		min-block-size: auto;
		resize: vertical;
	}
	.field :global(input:focus),
	.field :global(select:focus),
	.field :global(textarea:focus) {
		outline: none;
		border-color: var(--color-act);
		box-shadow: var(--focus-ring);
	}
</style>
