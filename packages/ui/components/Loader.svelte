<script lang="ts">
  // Brand loading animation (the hex + terminal-chevron mark drawing itself).
  // Ported from the admin app splash. Tokens-driven; respects reduced motion.
  let { size = 40, label = "Loading" }: { size?: number; label?: string } = $props();
</script>

<span class="ms-loader" role="status" aria-label={label} style={`--ms-loader-size:${size}px`}>
  <svg viewBox="0 0 40 40" fill="none" width={size} height={size} aria-hidden="true">
    <path class="hex" pathLength="1" d="M11 4.5h18l9 15.5-9 15.5H11L2 20Z" stroke-width="1.6" stroke-linejoin="round" />
    <path class="chev" pathLength="1" d="M14 14.5l5.5 5.5L14 25.5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</span>

<style>
  .ms-loader { display: inline-grid; place-items: center; line-height: 0; }
  .ms-loader .hex { stroke: var(--color-ink); stroke-dasharray: 1; stroke-dashoffset: 1; animation: ms-loader-draw 1.5s ease-in-out infinite; }
  .ms-loader .chev { stroke: var(--color-green, var(--color-act, #38ff88)); stroke-dasharray: 1; stroke-dashoffset: 1; animation: ms-loader-draw 1.5s ease-in-out infinite; animation-delay: 0.18s; }
  @keyframes ms-loader-draw {
    0% { stroke-dashoffset: 1; }
    55% { stroke-dashoffset: 0; }
    80%, 100% { stroke-dashoffset: 0; opacity: 0.12; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ms-loader .hex, .ms-loader .chev { animation: none; stroke-dashoffset: 0; }
  }
</style>
