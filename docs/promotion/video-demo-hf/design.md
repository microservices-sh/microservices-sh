# Design System — microservices.sh demo

Dark, terminal-native, developer-credible. Cinematic but honest — real runs, no marketing gloss.

## Colors

| Token | Hex | Use |
|-------|-----|-----|
| bg | `#070a08` | canvas |
| panel | `#0b0f0c` | terminal / card surface |
| panel-2 | `#0f1511` | raised rows, title bars |
| green | `#38ff88` | primary accent, success |
| green-strong | `#00f57a` | focal success, glow |
| green-soft | `#9fffc2` | success text on dark |
| amber | `#ffc857` | caution (scenes 1–2 only) |
| danger | `#ff6b5e` | failure, the caught mistake |
| text | `#eafbf1` | headlines, primary text |
| muted | `#91a89a` | secondary text |
| dim | `#5e7568` | labels, metadata |
| line | `#1d2a22` | hairline borders |
| line-strong | `#2a3c30` | structural borders |
| cyan | `#4dd8ff` | code keywords (sparingly) |

## Typography

- **Display:** Bricolage Grotesque (700/800) — headlines, the wordmark.
- **Body:** Hanken Grotesk (400/500/600) — captions, supporting copy.
- **Mono:** IBM Plex Mono (400/500/600) — terminal, code, labels, metadata.

## Corners
Soft: 9–14px on panels/cards, 999px on pills/chips.

## Depth
Layered glows on dark — radial accent glow behind focal elements, soft drop shadows on panels. No flat 1px web borders (use 2px+).

## Motion
Confident, measured. Entrances `.out` eases, varied per element. Terminal rows cascade in. The failure beat (✗) lands hard (fast, decisive). Ambient: subtle glow pulse on focal element, no gratuitous zoom.

## What NOT to do
- No flat solid backgrounds — always radial glow + faint honeycomb ghost texture.
- No amber/danger outside the problem beats — green is the resolved state.
- No marketing superlatives, no "100% secure", no cost/N× claims.
- No web-sized type — body ≥28px, labels ≥18px, headlines 64px+.
- Every terminal frame represents a real run.
