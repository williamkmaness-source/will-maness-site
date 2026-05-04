// Design system tokens — the single source of truth for all visual values.
// Components must import from here; no raw hex, px, or magic numbers in component files.
// These are mirrored as CSS custom properties in globals.css and as Tailwind theme
// utilities so both className="text-accent" and var(--accent) work everywhere.

export const colors = {
  bg: "#F7F3EC",
  bgSoft: "#EFE9DD",
  bgCode: "#F1ECE0",
  ink: "#1F1E1A",
  inkSoft: "#36342E",
  prose: "#2A2823",
  muted: "#6B665B",
  hint: "#8A8478",
  line: "#E5DFD3",
  lineStrong: "#D6CFC0",
  accent: "#2D4A3E",
  accentSoft: "#ECE4D2",
  clay: "#B85C38",
  claySoft: "#F4DDCF",
} as const;

export const fontFamilies = {
  // Newsreader loaded via next/font/google and injected as --font-newsreader CSS var.
  // The fallback chain is deliberate: Iowan Old Style on Mac/iOS, Georgia on Windows.
  serif: "var(--font-newsreader), 'Iowan Old Style', Charter, 'Source Serif Pro', Georgia, serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  mono: "'SF Mono', Menlo, Consolas, monospace",
} as const;

// All sizes in px; line-heights unitless; letter-spacing in em.
export const type = {
  displayXl: { size: 52, lh: 1.15, weight: 500, ls: -0.015 },
  displayLg: { size: 44, lh: 1.15, weight: 500, ls: -0.015 },
  displayMd: { size: 42, lh: 1.15, weight: 500, ls: -0.015 },
  h2:        { size: 28, lh: 1.25, weight: 500, ls: -0.01 },
  h3Card:    { size: 26, lh: 1.25, weight: 500, ls: -0.01 },
  h3Writing: { size: 24, lh: 1.30, weight: 500, ls: -0.01 },
  dek:       { size: 21, lh: 1.45, weight: 400, ls: 0 },
  lead:      { size: 20, lh: 1.55, weight: 400, ls: 0 },
  body:      { size: 18, lh: 1.65, weight: 400, ls: 0 },
  sub:       { size: 17, lh: 1.55, weight: 400, ls: 0 },
  currentlyVal: { size: 17, lh: 1.50, weight: 400, ls: 0 },
  ui:        { size: 14, lh: 1.50, weight: 400, ls: 0 },
  uiSm:      { size: 13, lh: 1.50, weight: 400, ls: 0 },
  label:     { size: 12, lh: 1.50, weight: 500, ls: 0.06 },
  eyebrow:   { size: 12, lh: 1.50, weight: 400, ls: 0.06 },
  meta:      { size: 12, lh: 1.50, weight: 400, ls: 0.04 },
  caption:   { size: 11, lh: 1.55, weight: 400, ls: 0.02 },
  tag:       { size: 11, lh: 1.40, weight: 400, ls: 0.02 },
} as const;

export const spacing = {
  xs:  "8px",
  sm:  "12px",
  md:  "16px",
  lg:  "24px",
  xl:  "36px",
  "2xl": "56px",
  "3xl": "80px",
  "4xl": "96px",
  "5xl": "120px",
} as const;

export const radii = {
  xs:   "3px",
  sm:   "4px",
  md:   "5px",
  lg:   "6px",
  xl:   "8px",
  full: "50%",
} as const;

export const motion = {
  durationFast: "120ms",
  durationBase: "200ms",
  easingDefault: "ease",
} as const;

export const layout = {
  containerMax:     "980px",
  articleProseMax:  "680px",
  articleAboutMax:  "720px",
  pagePaddingX:     "48px",
  pagePaddingXMobile: "24px",
} as const;
