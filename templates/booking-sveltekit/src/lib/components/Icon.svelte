<script lang="ts">
  // Tiny inline line-icon set (lucide-style paths) — avoids a runtime icon dep.
  let { name, size = 18 }: { name: string; size?: number } = $props();

  const PATHS: Record<string, string> = {
    calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    clock: "M12 7v5l3 2",
    search: "M21 21l-4.3-4.3",
    user: "M20 21a8 8 0 0 0-16 0",
    check: "M20 6 9 17l-5-5",
    x: "M18 6 6 18M6 6l12 12",
    "chevron-left": "M15 18l-6-6 6-6",
    "chevron-right": "M9 18l6-6-6-6",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  };
  const CIRCLES: Record<string, { cx: number; cy: number; r: number }> = {
    clock: { cx: 12, cy: 12, r: 9 },
    search: { cx: 11, cy: 11, r: 7 },
    user: { cx: 12, cy: 8, r: 4 },
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  style="flex:none;vertical-align:-0.18em"
>
  {#if CIRCLES[name]}
    <circle cx={CIRCLES[name].cx} cy={CIRCLES[name].cy} r={CIRCLES[name].r} />
  {/if}
  {#if PATHS[name]}
    <path d={PATHS[name]} />
  {/if}
</svg>
