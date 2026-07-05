# Build Log

A running record of meaningful units of work. Each entry is two to four sentences, date-stamped.

---

## 2026-07-05 — Issue #221: Seasonal palette — walking skeleton

**Slice.** Built the tracer-bullet first slice of the seasonal color palette app: a hex color in, snapped to its nearest shade inside a hardcoded Light Summer gamut, rendered as the in-season "Base" swatch. Proves the full pipeline (input → color math → gamut snap → UI) end-to-end and deploys via the normal build. Shipped as a project page the standard way — `content/projects/seasonal-palette.mdx` embeds the `<SeasonalPalette />` widget (registered in `mdx-components.tsx`), so it appears in the `/work` index and lives at `/work/seasonal-palette` via the `[slug]` template, matching the vienna-trainer pattern.

**Modules.** Added the pure logic core under `src/lib/palette/`: `color-math.ts` (culori-backed hex normalize, OKLCH conversion, CIEDE2000 perceptual distance), `gamut-snap.ts` (nearest-in-season), and `season-data.ts` (typed `Season`, one entry per season so adding seasons is data-only). Client UI in `src/components/projects/palette/PaletteSkeleton.tsx` keeps all chrome on design tokens; seasonal colors render as data via inline styles.

**Dependencies.** Added `culori` and `@types/culori`. **Tests.** 16 unit tests for color-math and gamut-snap (identical→0 distance, monotonic distance, snap returns an in-gamut member, invalid input handled). Full suite (435) green; `pnpm build` clean; page verified in a headless browser (`#c81e5a` → `#C77E99`). Light Summer hexes here are a reasonable standard set — the validated two-season data is owned by issue #223.

---

## 2026-05-08 — Vercel Web Analytics + Speed Insights

**Tracking.** Added `@vercel/analytics` and `@vercel/speed-insights` (both Next.js entries) and mounted `<Analytics />` and `<SpeedInsights />` in the root layout after `<Footer />`. Analytics captures pageviews; Speed Insights captures real-user Core Web Vitals (LCP, INP, CLS) — relevant given the Lighthouse 95+ goal in the spec. Both are privacy-friendly and cookieless. Data flow requires each product to be toggled on for the project in the Vercel dashboard (Settings → Analytics, Settings → Speed Insights) — packages alone do nothing until the toggles are flipped. Both toggles enabled 2026-05-09; data ingestion now active.

---

## 2026-05-06 — Issue #6: Vienna Trainer — Theory Tree JSON

**Script.** Wrote `scripts/build-theory-tree.mjs` (Lichess Masters API approach, documented) and `scripts/curate-theory-tree.mjs` (executed). The Lichess Masters API now requires OAuth, so the tree was built from hard-coded theory lines validated by chess.js 1.x. Five complete lines cover the three named mainlines (Vienna Gambit ×2, Symmetrical Vienna ×2, Vienna with ...Bc5 ×1), each traced to White's 8th move.

**Theory tree.** Wrote `content/projects/vienna-trainer/theory.json` — a nested JSON artifact with white nodes (one canonical `{san, from, to}` move each) and black nodes (weighted response arrays). Two non-obvious chess bugs caught during generation: (1) after king-side castling, Black's Bc5 pins the f2 pawn against the g1 king, preventing f4; (2) Bc5 also controls g1 directly, making O-O illegal until the bishop is challenged with Be3. Both fixed in the final theory lines.

**Packages.** Installed `chess.js 1.4.0`, `react-chessboard 5.10.0`, `vitest 4.1.5`, and `@vitest/coverage-v8` in preparation for Issues #7–#11.

---

## 2026-05-03 — Phase 0: Deploy

**GitHub and Vercel.** Created public repo at `github.com/williamkmaness-source/will-maness-site` and deployed to Vercel. Live at `https://website-nine-lemon-70.vercel.app`. Vercel CLI deployed successfully but the GitHub auto-deploy integration (push-to-deploy) needs the GitHub Login Connection configured in the Vercel dashboard — until then, redeploy manually with `vercel --prod` from the project directory.

---

## 2026-05-05 — Issue #1: 311 Equity Tracker tracer bullet

**Data source discovery.** Analyze Boston has fully migrated from Socrata to CKAN/OpenGov. The legacy `wc8w-udjp` endpoint is gone; data is now split into per-year resources queryable via `datastore_search_sql`. Mapped resource IDs for 2024, 2025, and 2026. The route handler covers year-spanning windows by fetching from each year's resource and merging.

**API route.** Built `src/app/api/311-data/route.ts` — a Next.js route handler that fetches the last 30 days of closed 311 cases from the CKAN SQL endpoint, computes median days to close and Equity Gap Index (max/min median ratio) per request type server-side, and responds with `Cache-Control: s-maxage=86400, stale-while-revalidate`. Whitespace-only neighborhoods are filtered in code (CKAN SQL blocks `TRIM()`).

**Frontend.** Built `DataProvider` (client component, React Context, fetch on mount, loading/error states) and `HeadlineCard` (editorial lede sentence: "Residents in X wait N× longer than residents in Y for the same Z request to be resolved"). Page at `/311` is a server component wrapping both. Recharts installed for upcoming chart issues.

---

## 2026-05-06 — Phase 1: MVP scaffold

**Content system.** Added `siteSchema` to `content-schemas.ts` and `getSiteContent()` / `getAdjacentProjects()` / `getAdjacentPosts()` helpers to `content.ts`. Created `content/site.mdx` — the single file Will edits to update hero copy, the homepage "currently" line, the about page bio, the "Currently" list, and the say-hi block. Installed `remark-frontmatter` (specified as a string in `next.config.ts` — Turbopack requires serializable plugin references, not function imports).

**Homepage.** Replaced Phase 0 placeholder with full homepage replicating `site-mockup.html` exactly. Hero pulls from `content/site.mdx` frontmatter; Selected Work pulls `featured: true` projects; Recent Writing pulls the 3 most recent posts. All copy is content-file-driven — zero hardcoded strings.

**New UI components.** `WorkCard` (project card in the work grid), `WritingTeaser` (post teaser in the writing list), `StackList` (tools-with-status-dots block for project pages, registered in `mdx-components.tsx`). Updated `mdx-components.tsx` with design-system-styled `h2`, `p`, `blockquote`, `a`, `code`, `pre` overrides so MDX prose matches the mockup exactly.

**All pages.** Built `/work` (work index), `/work/[slug]` (project page template with header + MDX body + prev/next nav), `/about` (full about page matching `site-about-page.html`, bio prose via `content/site.mdx` MDX body), `/writing` (writing index), `/writing/[slug]` (writing post template). Dynamic routes use `generateStaticParams` + dynamic import (`await import(\`content/...\${slug}.mdx\`)`) for MDX content — remark-frontmatter strips the YAML block before rendering.

**Infrastructure.** Programmatic OG images via `ImageResponse` (next/og) for home, `/work/[slug]`, and `/writing/[slug]`. Edge runtime only on the static root OG image; dynamic OG images use Node runtime (required by `generateStaticParams` + fs APIs). RSS feed at `/feed.xml`, sitemap at `/sitemap.xml`, `robots.txt`. `metadataBase` added to root layout.

**Content.** Updated `boston-civic-data.mdx` status to `in-progress`, set `featured: true`. Created placeholder writing post (`where-the-data-moat-lives.mdx`) — required so Turbopack can resolve the dynamic import context for `/writing/[slug]`. Will replaces this with the real essay.

**Build status.** Clean build — 23 static/SSG routes. No TypeScript errors.

---

## 2026-05-05 — Issue #1: 311 Equity Tracker tracer bullet

**Toolchain.** Installed Node.js v25.9.0 and pnpm v10.33.2 via Homebrew. Initialized a Next.js 16 project with TypeScript, App Router, Tailwind v4, and ESLint using `pnpm create next-app`. Moved planning spec documents to `_spec/` to keep them alongside the codebase without polluting the project root.

**Dependencies.** Added `framer-motion`, `@next/mdx`, `@mdx-js/loader`, `@mdx-js/react`, `gray-matter`, `zod`, and `@types/mdx`. These cover animation (used sparingly), MDX content processing, frontmatter parsing, and schema validation respectively.

**Design tokens.** Created `src/lib/tokens.ts` as the TypeScript source of truth for all colors, typography, spacing, radii, and motion values — transcribed exactly from `_spec/design-tokens.md`. Rewrote `src/app/globals.css` to use Tailwind v4's `@theme` block (CSS-based config, no `tailwind.config.ts`) and a `:root` block so both `className="text-accent"` and `var(--accent)` work throughout the codebase.

**Fonts.** Wired Newsreader via `next/font/google` in `src/app/layout.tsx`. The font is downloaded at build time and self-hosted — zero Google requests at runtime. Weight 400 and 500, both normal and italic styles. Exposed as `--font-newsreader` CSS variable consumed by the `@theme` `--font-serif` definition.

**Layout primitives.** Built `Container`, `Stack`, `Prose`, `SectionLabel`, `Eyebrow`, `MetaStrip`, `Tag`, and `ClayDot`. Each has a header comment explaining its purpose. All visual values (sizes, colors, spacing) reference Tailwind utility classes backed by the token system — no raw hex or magic numbers.

**Nav and Footer.** Built to match the mockups exactly. `Nav` is the only client component in Phase 0 (needs `usePathname` for active link state). `Footer` is a server component. Both use `Container` for consistent horizontal layout.

**MDX pipeline.** Configured `next.config.ts` with `@next/mdx` and `pageExtensions`. Created `mdx-components.tsx` at the project root (required by App Router for MDX to work). Created `src/lib/content-schemas.ts` (Zod schemas for project and writing frontmatter) and `src/lib/content.ts` (server-side functions that read and validate the `content/` directory).

**Content directories.** Created `content/projects/` with four placeholder MDX files (`local-ai-stack`, `this-site`, `project-stellar`, `boston-civic-data`) and `content/writing/` with a `.gitkeep`. All frontmatter validates against the Zod schemas.

**Dev component gallery.** Built `src/app/_dev/components/page.tsx` — a visual inventory of all UI primitives. Gated behind a `NODE_ENV === "development"` check; returns 404 in production.

**Docs.** Wrote `docs/setup.md` (clone → dev → publish workflow), `docs/concepts.md` (App Router, server vs client components, next/font, Tailwind v4, MDX, content collection, Zod), and this build log.
