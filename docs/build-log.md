# Build Log

A running record of meaningful units of work. Each entry is two to four sentences, date-stamped.

---

## 2026-08-07 — Music analyzer: lookup, compare, and top 100 views

**Built.** The analyzer's three read-side views on top of the #213 schema and the #214 extractor/Spotify client already on `main`. `music-queries` adds the only two DB reads the views need — the latest weekly `music_feature_scores` snapshot and the latest top 100 with its precomputed features. `song-breakdown` composes one track's four features and their hot-to-indie ratings, and is shared by `/api/music/song` and `/api/music/compare` so a song can never be rated one way in the lookup tab and differently in compare. `/api/music/top100` serves the snapshot straight from Postgres with no Spotify calls at read time. UI is `FeatureRatingBadge` → `SongBreakdown` → `SongSearchPanel`, composed into `SongLookup`, `SongCompare`, and `Top100Dashboard` behind `MusicAnalyzerTabs`, reachable at `/work/music_analyzer` with the narrative page at `/work/music-analyzer`.

**Degradation.** Every path assumes the weekly pipeline may never have run, because it hasn't: a missing scores snapshot yields null ratings and a "no trend data" line rather than an error, an empty top 100 renders the empty state, and absent Spotify credentials (#212) return a 503 the UI shows as designed copy. Each compare column owns its own `useSongSearch` instance with a request-id guard, so searching one column neither resets the other nor lets a slow response overwrite a fast one.

**Scope.** Closes #216, #217, #218. Left `featured: false` in `music-analyzer.mdx` — flipping it is #219, which is explicitly gated on a production pipeline run. Build, lint, `tsc`, and 471 tests all clean.

## 2026-07-28 — Palette Slices 5 & 6: swatch-picker input and polish pass

**Built.** Split the palette app's color input into two tabs behind a new `ColorInput` — the existing hex field, and a new `SwatchGrid` rendering every color in the active season's `colors[]`. Both modes report through one `onChange`, so a tapped swatch and a typed hex are indistinguishable to the engine. Added `use-copy-hex`, a shared copy-with-feedback hook keyed by caller-supplied id (so a color appearing in two swatches only confirms on the one clicked); result-card blocks copy on click, and in the picker the swatch selects while its hex caption copies, since one tap can't do both.

**Fixed.** `PaletteSkeleton` now holds the last *accepted* color separately from the raw field text. Previously any unparseable keystroke drove `buildPalettes` to `[]` and blanked the cards mid-edit — typing toward `#7fb0d0` cleared the screen at `#7fb0`. Results are memoized on `(acceptedColor, season.colors)`, which is also what makes them refresh when the season changes. Grid columns and 44px swatch targets scale down for phones.

**Scope.** Closes #225 and #226 (PR #244). The season *selector* is still #223 (HITL — the Light Summer / Dull Winter hex sets need visual sign-off); everything here reads from the `season` prop, so it follows a selector the moment one exists. Season blurb deliberately left out — that's a #223 criterion. Build, lint, `tsc`, and 471 tests all clean.

## 2026-07-18 — QA #08: refresh MEMORY.md and add the missing Phase 1 quiz

**Fix.** `MEMORY.md`'s status table still read Phase 1 as "Ready to start" (last touched 2026-05-06) while Phases 1–3 had all shipped and five post-MVP projects had gone live; it also listed the stack as Next.js 15 (actually 16) and an open headshot question that was since resolved. Updated the phase table to reflect reality, added a note listing the post-MVP projects, corrected the Next.js version, and closed the headshot open-question. Separately, `docs/quizzes/` had `phase-0.md` and `phase-2.md` but no `phase-1.md` (required by the execution brief's teaching-overlay process) — wrote it in the same format as the others, with 8 questions grounded in the real Phase 1 code (content collections, the `[slug]` route + `generateStaticParams`, `notFound()`, per-slug OG images, the derived sitemap, per-route noindex, server-component/Lighthouse reasoning, and prev/next adjacency ordering).

**Verified.** Docs-only change (no runtime surface); quiz answers cross-checked against `content.ts`, the `[slug]` template, `sitemap.ts`, and `robots.ts`. Eighth of the 9 findings in PR #233.
## 2026-07-18 — QA #03: About page rendered two h1 elements

**Fix.** The closing line of `content/site.mdx`'s bio began with a stray `# `, so MDX rendered it as a second `<h1>` on `/about` — invisible in QA because `mdx-components.tsx` styles `h2` but not `h1`, and Tailwind's preflight strips default heading sizing, so it looked like a paragraph while being a real second top-level heading (an accessibility and minor SEO smell). Removed the leading `#`; the sentence now renders as a styled `<p>`, matching how it reads in the rest of the block.

**Verified.** `pnpm build` clean; against a production server `/about` now has exactly one `<h1>` ("About") and the outreach sentence renders as `<p class="... text-prose ...">`. Fifth of the 9 findings in PR #233.
## 2026-07-18 — QA #05: status indicators on work cards

**Fix.** The execution brief requires the `/work` index to show status indicators (in progress / complete / forthcoming), but `WorkCard` only ever acted on `status` to dim `forthcoming` cards — `in-progress` (7 of 10 projects) rendered visually identical to `complete`, with no label or dot anywhere. Added a `StatusIndicator` to the card meta row: `in-progress` shows a small active moss dot + "In progress" (on-system mono/muted status-label styling), `forthcoming` shows a "Forthcoming" label plus the existing dim, and `complete` stays unmarked so its absence is the distinction. Deliberately avoided `ClayDot` here — clay is reserved for sparing personal-mark moments, not 7 cards.

**Verified.** Typecheck, lint, and `pnpm build` clean. Rendered `/work` in headless Chromium: exactly 7 "In progress" labels (matching the 7 in-progress projects), the 3 complete cards clean, and every label single-line (18px, no wrap) including the tag-crowded Sable card. Fourth of the 9 findings in PR #233.
## 2026-07-18 — QA #02: noindex the standalone /ember dashboard

**Fix.** `/ember` — the standalone server-rendered EmberBrief dashboard — returned HTTP 200 with no robots directive, so it was an indexable duplicate of the canonical `/work/ember` project page (a duplicate-content signal on a site whose project pages are the SEO surface). Added `robots: { index: false, follow: true }` to the route's metadata. Chose noindex over a 301 redirect or deletion because `content/projects/ember.mdx` documents the dashboard as living at `/ember`, so the URL should stay reachable — it just shouldn't be indexed twice.

**Verified.** `pnpm build` clean; started the production server and confirmed `/ember` now emits `<meta name="robots" content="noindex, follow">`, `/work/ember` still has no robots directive (stays indexable), `/ember` still returns 200, and only the canonical `/work/ember` appears in the sitemap. Third of the 9 findings in PR #233.

## 2026-07-18 — QA #04: live-data widgets no longer leak raw error strings

**Fix.** `StaffingDashboard`, `EmberDashboard`, and `RequestTypeBreakdown` each rendered the raw thrown fetch message (e.g. `API error 503`) straight to the visitor when their backing API failed — developer-facing copy on exactly the widgets most likely to be mid-failure when a hiring manager clicks through (they depend on external pipelines and a Neon Postgres that can cold-start). Each now logs the raw error to the console and renders a fixed, user-facing sentence instead ("temporarily unavailable — check back shortly" / the existing Ember fallback), keeping the thrown message out of the render path.

**Verified.** Typecheck, lint, and `pnpm build` clean. Drove `/work/boston-civic-data` and `/work/ember` in headless Chromium with no DB configured (both APIs 503): confirmed the friendly copy renders and no `API error NNN` string appears anywhere. Second of the 9 findings in PR #233.
## 2026-07-18 — QA #01: `/work/vendor_feed` no longer 500s on a DB hiccup

**Fix.** `/work/vendor_feed` (the live Vendor Intelligence feed, linked from the `vendor-feed` writeup and the homepage preview) read Postgres at request time with no guard, so a missing connection string or any transient DB issue — Neon cold start, pool exhaustion, credential rotation — crashed the public URL with an unstyled Next.js 500. Wrapped the `getFeedEntities()` call in try/catch and degraded to a designed fallback ("temporarily unavailable") rendered inside the normal nav/footer frame, mirroring the pattern `/ember/page.tsx` already uses. Chose graceful handling over the issue-draft's "just delete it" because the route is the actual live feed and is actively linked — deletion would break those links.

**Verified.** `pnpm build` clean; started the production server with no DB env vars (the exact failing condition) — `curl /work/vendor_feed` now returns HTTP 200 with the fallback copy and site chrome instead of a 500. Typecheck and build green. Top-ranked of the 9 open findings re-verified in PR #233.
## 2026-07-18 — QA #06: custom 404 page

**Fix.** Any unmatched route fell through to Next's bare default 404 ("This page could not be found." — no nav, no footer, no site chrome), the one place the site broke visual continuity. Added `src/app/not-found.tsx` reusing `Container` and the standard page-header type scale, rendering inside the global `Nav`/`Footer` frame with a "404" eyebrow, a one-line message, and an accent "← Back home" link.

**Verified.** Typecheck, lint, and `pnpm build` clean. Against a production server, an unmatched route (`/this-does-not-exist`) returns HTTP **404** with the custom heading, the back-home link, and both the global nav and footer present (confirmed via curl + a headless screenshot). Sixth of the 9 findings in PR #233.
## 2026-07-18 — QA #07: remove create-next-app scaffold assets

**Fix.** `public/` still carried the five default `create-next-app` scaffold icons (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`), none referenced anywhere in `src/` or `content/`. Harmless functionally, but the repo is explicitly part of the credibility pitch, so leftover boilerplate is exactly what a technical reviewer browsing the code notices. Confirmed zero references (grep across `src`, `content`, and root config), then removed all five; `public/` now holds only the headshot.

**Verified.** `grep` for each filename across the codebase returned nothing before deletion; `pnpm build` clean afterward. Seventh of the 9 findings in PR #233.

## 2026-07-05 — Issue #224: Seasonal palette — all schemes + curated results

**Slice.** The palette widget now surfaces several four-role palettes at once — one per harmony scheme (complementary, analogous, triadic, split-complementary) — instead of a single card. Because every color is snapped into a finite season, schemes whose partners land on the same shade yield identical palettes; those are de-duplicated so each card is clearly distinct (a typical input yields three).

**Modules.** Added `buildPalettes(anchor, gamut)` to `palette-assembler.ts`: runs all schemes via the existing `assemblePalette`, keys each result by its four snapped colors, and collapses duplicates (keeping the more classic scheme). `PaletteSkeleton.tsx` now maps the result set to a stack of `PaletteCard`s. 4 new unit tests (distinctness, complementary-first ordering, in-gamut, single-color-gamut collapse → one). Palette suite 32, full suite green; lint + build clean.

**Slice.** Extended the palette engine from a single Base swatch to a full four-role outfit palette (Base / Secondary / Neutral / Accent) rendered as a card on `/work/seasonal-palette`. Base is the snapped anchor, Secondary is the complementary partner snapped back in-season, Neutral is the season's lowest-chroma tone, and Accent is the highest-contrast color from Base — all guaranteed in-gamut.

**Modules.** Added `src/lib/palette/harmony.ts` (OKLCH hue rotation; all four schemes implemented, complementary wired for now) and `palette-assembler.ts` (pure `assemblePalette(color, gamut, scheme)` → `RolePalette`). New `PaletteCard.tsx` presentational component; `PaletteSkeleton.tsx` now assembles and renders it. 12 new unit tests (harmony hue math + role assignment invariants), 28 in the palette suite; full suite green, build + lint clean. Multiple schemes and de-dup are next in #224.

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
