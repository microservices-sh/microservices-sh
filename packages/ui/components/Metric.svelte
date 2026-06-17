<script lang="ts">
	interface Props {
		label: string;
		value: string;
	}
	let { label, value }: Props = $props();
</script>

<div class="metric">
	<span>{label}</span>
	<b>{value}</b>
</div>

<style>
	.metric {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background: var(--color-panel);
		padding: 16px;
	}
	.metric span {
		display: block;
		color: var(--color-ink-faint);
		font-size: 0.75rem;
		letter-spacing: 0.01em;
		margin-block-end: 10px;
	}
	.metric b {
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: 0;
	}
</style>
