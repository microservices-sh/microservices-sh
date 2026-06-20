<script lang="ts">
	import type { Snippet } from "svelte";

	// Labeled form control. Pass the input/select/textarea as the default slot
	// and give it the same `id` so the label's `for` associates correctly.
	// Optional `hint` (persistent helper text) and `error` (field-level error,
	// announced to assistive tech) render below the control.
	interface Props {
		label: string;
		id?: string;
		hint?: string;
		error?: string;
		required?: boolean;
		children: Snippet;
	}

	let { label, id, hint, error, required = false, children }: Props = $props();
</script>

<div class="field" class:field--invalid={!!error}>
	<label class="field__label" for={id}>
		{label}{#if required}<span class="field__req" aria-hidden="true">*</span>{/if}
	</label>
	{@render children()}
	{#if error}
		<p class="field__error" id={`${id}-error`} role="alert">{error}</p>
	{:else if hint}
		<p class="field__hint" id={`${id}-hint`}>{hint}</p>
	{/if}
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
	.field__req {
		margin-inline-start: 2px;
		color: var(--color-red);
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
		transition:
			border-color 200ms var(--ease),
			box-shadow 200ms var(--ease);
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
	.field--invalid :global(input),
	.field--invalid :global(select),
	.field--invalid :global(textarea) {
		border-color: var(--color-red);
	}
	.field--invalid :global(input:focus),
	.field--invalid :global(select:focus),
	.field--invalid :global(textarea:focus) {
		box-shadow: 0 0 0 3px var(--color-red-soft);
	}
	.field__hint {
		margin: 0;
		font-size: 0.78rem;
		color: var(--color-ink-faint);
	}
	.field__error {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--color-red);
	}
</style>
