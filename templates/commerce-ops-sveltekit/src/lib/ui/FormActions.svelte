<script lang="ts">
	import Button from "./Button.svelte";

	// Standard form footer: a right-aligned Save/Cancel bar separated by a hairline
	// rule. Used by dedicated create/edit pages so every form ends the same way.
	interface Props {
		submitLabel?: string;
		submittingLabel?: string;
		/** Navigate-away cancel (dedicated create/edit pages). */
		cancelHref?: string;
		/** In-place cancel (inline edit toggles) — takes precedence over cancelHref. */
		oncancel?: () => void;
		cancelLabel?: string;
		submitting?: boolean;
		disabled?: boolean;
	}

	let {
		submitLabel = "Save",
		submittingLabel,
		cancelHref,
		oncancel,
		cancelLabel = "Cancel",
		submitting = false,
		disabled = false
	}: Props = $props();
</script>

<div class="form-actions">
	{#if oncancel}
		<Button type="button" variant="ghost" onclick={oncancel}>{cancelLabel}</Button>
	{:else if cancelHref}
		<Button href={cancelHref} variant="ghost">{cancelLabel}</Button>
	{/if}
	<Button type="submit" variant="primary" disabled={disabled || submitting}>
		{submitting ? (submittingLabel ?? submitLabel) : submitLabel}
	</Button>
</div>

<style>
	.form-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		margin-block-start: 18px;
		padding-block-start: 16px;
		border-block-start: 1px solid var(--color-line);
	}
</style>
