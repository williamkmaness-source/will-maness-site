# Design Tokens — Will Maness Site

The canonical source of truth for colors, typography, spacing, and radii. Implementation should consume these via `lib/tokens.ts` (TypeScript) plus the matching Tailwind config. No raw hex values anywhere in components.

---

## Colors

The palette is warm and restrained. Two accents — a deep moss green and a clay orange — used at very different volumes. Moss is the workhorse (links, primary buttons, all interactive states). Clay is the signature touch (eyebrows, asides, the dot in personal-mark moments) and should appear sparingly.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F7F3EC` | Page background. Warm cream — the single biggest tonal lever. |
| `bg-soft` | `#EFE9DD` | Raised surfaces (the saying-hi block, browser-chrome bar in mockups). |
| `bg-code` | `#F1ECE0` | Inline code, code blocks. |
| `ink` | `#1F1E1A` | Primary text. Deep ink, never pure black. |
| `ink-soft` | `#36342E` | Secondary ink (rarely needed). |
| `prose` | `#2A2823` | Long-form body prose. Slightly softer than `ink` to ease reading at length. |
| `muted` | `#6B665B` | Metadata, section labels, secondary copy. |
| `hint` | `#8A8478` | Tertiary, captions, dates, the smallest text. |
| `line` | `#E5DFD3` | Default borders and dividers. Used at 0.5px. |
| `line-strong` | `#D6CFC0` | Emphasis borders, meta-strip separators. |
| `accent` | `#2D4A3E` | Deep moss. Links, hover states, primary button fill, blockquote rule. |
| `accent-soft` | `#ECE4D2` | Tag pill backgrounds. |
| `clay` | `#B85C38` | Signature accent. Eyebrows, italic asides, the dot in personal-mark moments. Used sparingly. |
| `clay-soft` | `#F4DDCF` | Reserved — not currently used in mocks but available if a clay-tinted surface is ever needed. |

Notes for implementation:
- Wire these into Tailwind as named colors so utilities like `text-ink`, `bg-bg-soft`, `border-line` work directly.
- Also expose them as CSS custom properties on `:root` so MDX content and inline SVGs can reference them via `var(--accent)` etc.
- No dark mode at MVP. The cream palette doesn't translate cleanly; if dark mode is added later it's a deliberate design pass, not a class flip.

---

## Typography

Three font stacks. Serif does the heavy lifting (headlines, body prose, deks). Sans is the quiet UI register (nav, metadata, captions, tags). Mono is reserved for technical and small-caps moments — eyebrows, dates, key labels, and code.

### Stacks

```
serif: 'Newsreader', 'Iowan Old Style', 'Charter', 'Source Serif Pro', Georgia, serif
sans:  -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif
mono:  'SF Mono', 'Menlo', 'Consolas', monospace
```

`Newsreader` should be self-hosted via `next/font/google`. The system fallback chain ensures correct rendering on Mac/iOS (Iowan Old Style) and Windows (Georgia) before web font loads.

### Scale

All sizes in pixels. Line-height is unitless. Letter-spacing in em.

| Token | Family | Size | LH | Weight | Letter-spacing | Use |
|---|---|---|---|---|---|---|
| `display-xl` | serif | 52 | 1.15 | 500 | -0.015 | Homepage hero headline |
| `display-lg` | serif | 44 | 1.15 | 500 | -0.015 | Project page H1 |
| `display-md` | serif | 42 | 1.15 | 500 | -0.015 | About H1 |
| `h2` | serif | 28 | 1.25 | 500 | -0.01 | Section headings within articles |
| `h3-card` | serif | 26 | 1.25 | 500 | -0.01 | Project card titles |
| `h3-writing` | serif | 24 | 1.30 | 500 | -0.01 | Writing item titles |
| `dek` | serif italic | 21 | 1.45 | 400 | 0 | Article deks (italic, muted color) |
| `lead` | serif | 20 | 1.55 | 400 | 0 | Lead paragraph (just below the dek/meta) |
| `body` | serif | 18 | 1.65 | 400 | 0 | Body prose |
| `sub` | sans | 17 | 1.55 | 400 | 0 | Hero subtitle |
| `currently-val` | serif | 17 | 1.50 | 400 | 0 | "Currently" list values |
| `ui` | sans | 14 | 1.50 | 400 | 0 | Nav links, footer text, default UI |
| `ui-sm` | sans | 13 | 1.50 | 400 | 0 | Small UI, secondary |
| `label` | sans | 12 | 1.50 | 500 | 0.06 / uppercase | Section labels |
| `eyebrow` | mono | 12 | 1.50 | 400 | 0.06 / uppercase | Article category eyebrows (in `clay`) |
| `meta` | mono | 12 | 1.50 | 400 | 0.04 / uppercase | "DAILY", "WEEKLY" status, key labels |
| `caption` | mono | 11 | 1.55 | 400 | 0.02 | Captions, tiny dates, mark caption |
| `tag` | sans | 11 | 1.40 | 400 | 0.02 | Tag pills |

Two weights only: 400 regular, 500 medium. Never 600 or 700 — the serif headlines hold their hierarchy through size, not weight.

---

## Spacing

Vertical rhythm uses a mix of px and rem, but always from the same scale. No magic numbers in components.

| Step | Value |
|---|---|
| `xs` | 8px |
| `sm` | 12px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 36px |
| `2xl` | 56px |
| `3xl` | 80px |
| `4xl` | 96px |
| `5xl` | 120px |

Section-to-section spacing on long pages is typically `2xl` to `3xl`. Card-internal spacing is `xs` to `md`. Hero block bottom margin is `4xl`.

---

## Borders & radii

Borders are 0.5px, almost always. The 2px exception is the blockquote left rule and the clay-italic aside left rule — they're earning emphasis, and the choice is deliberate.

| Token | Value |
|---|---|
| `border-default` | 0.5px solid `line` |
| `border-strong` | 0.5px solid `line-strong` |
| `border-rule` | 2px solid `accent` (blockquote) or `clay` (aside) |

| Radius | Value | Use |
|---|---|---|
| `radius-xs` | 3px | Inline code |
| `radius-sm` | 4px | Tag pills, small UI |
| `radius-md` | 5px | Buttons, code blocks |
| `radius-lg` | 6px | Code blocks (alt), say-hi block |
| `radius-xl` | 8px | Browser chrome / large surfaces |
| `radius-full` | 50% | Dots, avatars |

---

## Motion

Restrained. Most transitions are color shifts on hover.

| Token | Value | Use |
|---|---|---|
| `duration-fast` | 120ms | Color hover shifts on links and nav |
| `duration-base` | 200ms | Larger UI transitions |
| `easing-default` | `ease` | Default; cubic-bezier overrides only when warranted |

Page transitions are not part of the MVP. If added later, use Framer Motion's `LayoutGroup` or the App Router transition API — not a global page-fade.

---

## Layout

| Token | Value | Use |
|---|---|---|
| `container-max` | 980px | Site outer container |
| `article-prose-max` | 680px | Project page reading column |
| `article-about-max` | 720px | About page column |
| `page-padding-x` | 48px (desktop), 24px (mobile) | Container side padding |

Mobile breakpoints can match Tailwind defaults (640 / 768 / 1024). The mockups are desktop-only at this stage; mobile adaptation is a Phase 1 task with explicit decisions about what reflows.
