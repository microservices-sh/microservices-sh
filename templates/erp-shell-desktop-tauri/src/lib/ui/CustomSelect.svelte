<script lang="ts">
  import Badge from "./Badge.svelte";

  type Tone = "neutral" | "good" | "warn" | "bad" | "info";

  export interface CustomSelectOption {
    value: string;
    label: string;
    meta?: string;
    badge?: string;
    tone?: Tone;
  }

  interface Props {
    id: string;
    name?: string;
    label: string;
    options: CustomSelectOption[];
    value?: string;
    placeholder?: string;
    hideLabel?: boolean;
    disabled?: boolean;
    class?: string;
    onChange?: (value: string) => void;
  }

  let {
    id,
    name,
    label,
    options,
    value = "",
    placeholder = "Select an option",
    hideLabel = false,
    disabled = false,
    class: cls = "",
    onChange
  }: Props = $props();

  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let open = $state(false);
  let current = $state("");
  let activeIndex = $state(0);
  let seenValue = $state<string | undefined>(undefined);

  const selected = $derived(options.find((option) => option.value === current));
  const listId = $derived(`${id}-listbox`);
  const labelId = $derived(`${id}-label`);
  const valueId = $derived(`${id}-value`);

  function optionIndex(optionValue: string) {
    const index = options.findIndex((option) => option.value === optionValue);
    return index >= 0 ? index : 0;
  }

  $effect(() => {
    const next = value || options[0]?.value || "";
    if (seenValue !== value || !current) {
      seenValue = value;
      current = next;
      activeIndex = optionIndex(next);
    }
  });

  function setOpen(next: boolean) {
    if (disabled) return;
    open = next;
    if (next) activeIndex = optionIndex(current);
  }

  function choose(option: CustomSelectOption) {
    current = option.value;
    activeIndex = optionIndex(option.value);
    open = false;
    onChange?.(option.value);
    trigger?.focus();
  }

  function move(delta: number) {
    if (options.length === 0) return;
    activeIndex = (activeIndex + delta + options.length) % options.length;
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(-1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && options[activeIndex]) choose(options[activeIndex]);
      else setOpen(true);
    } else if (event.key === "Escape") {
      open = false;
    }
  }

  function handleWindowClick(event: MouseEvent) {
    if (!open) return;
    if (root?.contains(event.target as Node)) return;
    open = false;
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === "Escape") {
      open = false;
      trigger?.focus();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div bind:this={root} class="custom-select {cls}" data-open={open}>
  {#if name}
    <input type="hidden" {name} value={current} />
  {/if}

  <span id={labelId} class="custom-select__label" class:sr-only={hideLabel}>{label}</span>
  <button
    bind:this={trigger}
    id={id}
    type="button"
    class="custom-select__trigger"
    class:has-badge={Boolean(selected?.badge)}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={listId}
    aria-labelledby={hideLabel ? undefined : `${labelId} ${valueId}`}
    aria-label={hideLabel ? label : undefined}
    {disabled}
    onclick={() => setOpen(!open)}
    onkeydown={handleTriggerKeydown}
  >
    <span id={valueId} class="custom-select__value">
      <strong>{selected?.label ?? placeholder}</strong>
    </span>
    {#if selected?.badge}
      <Badge tone={selected.tone ?? "neutral"}>{selected.badge}</Badge>
    {/if}
    <span class="custom-select__chevron" aria-hidden="true"></span>
  </button>

  {#if open}
    <div id={listId} class="custom-select__list" role="listbox" aria-labelledby={labelId}>
      {#each options as option, index}
        <button
          id={`${id}-option-${index}`}
          type="button"
          class="custom-select__option"
          class:is-active={index === activeIndex}
          role="option"
          aria-selected={option.value === current}
          tabindex="-1"
          onmouseenter={() => (activeIndex = index)}
          onclick={() => choose(option)}
        >
          <span>
            <strong>{option.label}</strong>
            {#if option.meta}
              <small>{option.meta}</small>
            {/if}
          </span>
          {#if option.badge}
            <Badge tone={option.tone ?? "neutral"}>{option.badge}</Badge>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .custom-select {
    position: relative;
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .custom-select__label {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .custom-select__trigger,
  .custom-select__option {
    width: 100%;
    min-width: 0;
    margin: 0;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    color: var(--color-ink);
    font-family: var(--font-sans);
    letter-spacing: 0;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transform: none;
  }

  .custom-select__trigger {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 14px;
    align-items: center;
    gap: 10px;
    min-block-size: 42px;
    padding: 8px 11px;
    text-align: start;
    transition:
      border-color 180ms var(--ease),
      box-shadow 180ms var(--ease),
      background 180ms var(--ease);
  }

  .custom-select__trigger.has-badge {
    grid-template-columns: minmax(0, 1fr) auto 14px;
  }

  .custom-select__trigger:hover,
  .custom-select[data-open="true"] .custom-select__trigger {
    border-color: var(--color-act);
    background: color-mix(in srgb, var(--color-panel) 86%, var(--color-green-soft));
    box-shadow: var(--shadow-card);
  }

  .custom-select__trigger:focus-visible {
    outline: 2px solid var(--color-act);
    outline-offset: 2px;
    box-shadow: var(--focus-ring);
  }

  .custom-select__value,
  .custom-select__option > span {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .custom-select__value strong,
  .custom-select__option strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .custom-select__value small,
  .custom-select__option small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-muted, var(--color-ink-soft));
    font-size: 0.76rem;
    line-height: 1.25;
  }

  .custom-select__chevron {
    inline-size: 8px;
    block-size: 8px;
    border-inline-end: 1.5px solid currentColor;
    border-block-end: 1.5px solid currentColor;
    opacity: 0.65;
    transform: rotate(45deg) translateY(-2px);
    transition: transform 180ms var(--ease);
  }

  .custom-select[data-open="true"] .custom-select__chevron {
    transform: rotate(225deg) translateY(-1px);
  }

  .custom-select__list {
    position: absolute;
    z-index: 40;
    inset-block-start: calc(100% + 8px);
    inset-inline: 0;
    display: grid;
    gap: 4px;
    max-block-size: min(320px, 56vh);
    overflow: auto;
    padding: 6px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    box-shadow: var(--shadow-lg);
  }

  .custom-select__option {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-block-size: 46px;
    padding: 9px 10px;
    border-color: transparent;
    box-shadow: none;
    text-align: start;
    transition:
      background 150ms var(--ease),
      border-color 150ms var(--ease);
  }

  .custom-select__option:hover,
  .custom-select__option.is-active {
    border-color: var(--color-line);
    background: var(--color-surface-2, var(--color-panel-subtle));
  }

  .custom-select__option[aria-selected="true"] {
    border-color: var(--color-act);
    background: var(--color-green-soft);
  }

  .custom-select__trigger:disabled,
  .custom-select__option:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .custom-select__trigger,
    .custom-select__chevron,
    .custom-select__option {
      transition: none;
    }
  }
</style>
