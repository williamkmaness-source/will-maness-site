# QA pass — reading the site as a VP-of-Product hiring manager

_2026-08-23. Fourth pass in this series, following 2026-07-11
(`2026-07-11-hiring-manager-qa.md`), 2026-07-18
(`2026-07-18-hiring-manager-qa.md`), and 2026-07-25
(`2026-07-25-hiring-manager-qa.md`, PR #242). A fifth write-up
(`2026-08-01-hiring-manager-qa.md`) was drafted in PR #245 but has sat open
and unreviewed for three weeks — this pass supersedes it; see "Housekeeping"
below. Ran `pnpm install`, a clean `pnpm build && pnpm start`, and `pnpm dev`
against today's `main`, crawled every published route at desktop (1440px)
and mobile (390px) with a headless browser (console errors, failed
requests, screenshots, meta tags, images), re-read the relevant source for
all 10 prior findings, read every MDX content file end to end, and ran
`pnpm lint` and `pnpm test`._

## Headline: findings 01–08 are genuinely fixed; 09 and 10 are still open; 8 new findings

**`main` hasn't moved since 2026-08-01** (the merge of #242) — three weeks
with no new commits, even though #246 (music-analyzer views) and #247
(palette two-season data model) are open and green. So this pass is a
re-verification against unchanged code, not a check on new work — the new
findings below come from looking harder at what was already there, not from
regressions.

Directly re-verified all 8 bug/chore findings from the original 07-11
report against today's build and source — all 8 are fixed, matching what
PR #245 already reported three weeks ago:

| # | Finding | Verified fix |
| - | ------- | ------------ |
| 01 | `/work/vendor_feed` 500 | `src/app/work/vendor_feed/page.tsx` guards the Postgres read in try/catch and renders a designed fallback; the route itself was kept (not deleted), which is a valid alternative the original draft allowed for |
| 02 | `/ember` indexable duplicate | Ships `robots: { index: false, follow: true }`; confirmed in source |
| 03 | `/about` double `<h1>` | `content/site.mdx` was restructured into the new `siteSchema` (structured YAML fields), and the stray heading line in the bio prose is now plain text — confirmed no second `<h1>` |
| 04 | Raw error string in widgets | `StaffingDashboard`, `EmberDashboard`, and `RequestTypeBreakdown` all capture the raw error in state but render a fixed sentence ("Live data temporarily unavailable...", "Could not load fire data...") — the raw message is never interpolated into the render |
| 05 | No in-progress indicator | `WorkCard.tsx` now has a `StatusIndicator` component rendering "In progress" / "Forthcoming" labels tied to `project.status` |
| 06 | No custom 404 | `src/app/not-found.tsx` exists |
| 07 | Unused scaffold SVGs | `public/` contains only `will-maness-headshot.jpg` |
| 08 | Stale `MEMORY.md` / missing quiz | `MEMORY.md` reflects Phases 0–3 done and the post-MVP roster; `docs/quizzes/phase-1.md` exists |

No regressions: `pnpm build`, `pnpm lint` clean, `pnpm test` passing.

**Finding 09** (Sable's positioning) remains an open editorial call —
`content/projects/project-stellar.mdx` unchanged, still tagged `game
design`/`writing`/`art direction`, not `featured`. One small addition this
pass: the file itself lives at the URL `/work/project-stellar` while the
project is named "Sable" everywhere in its own copy and on the work index —
worth folding into whichever direction you take on 09, not a separate bug.

**Finding 10** (Pipeline Dashboard's copy describes chess tracking it
doesn't do) is **still unfixed and still not filed as a real issue** —
`content/projects/pipeline-dashboard.mdx` still promises "Boston 311 and
Chess tournament tracking" and a future "Chess pipeline... pings the
Lichess API hourly," but `PipelineId` in `types.ts` has no `chess` member.
This pass found the mismatch runs deeper than the original write-up
caught — see finding 15 below, which folds into and supersedes 10 with the
full picture.

## Housekeeping

**PR #245** (the 2026-08-01 follow-up, which marked 01–08 resolved and
drafted finding 10) has been open for three weeks with no review. This pass
re-derives the same 01–08 verification independently and carries finding 10
forward with more detail, so **this PR can replace #245** — recommend
closing #245 without merging once this one is reviewed, same as the
07-25→08-01 handoff recommended (and didn't quite get acted on) last time.

## New findings this pass

### 11. Homepage share image (`og:image`) is broken in production — **Blocker**

`src/app/opengraph-image.tsx`'s title block (lines 38–52) wraps two
children — a bare text node ("Product strategy and engineering") and a
`<span>` — inside a `<div>` that has no `display` set at all:

```tsx
<div
  style={{
    fontSize: 52,
    fontWeight: 500,
    color: "#1F1E1A",
    lineHeight: 1.15,
    letterSpacing: "-0.015em",
    marginBottom: 24,
    maxWidth: 900,
  }}
>
  Product strategy and engineering
  <span style={{ color: "#2D4A3E" }}> in the AI-and-data stack.</span>
</div>
```

Satori (the renderer behind `next/og`'s `ImageResponse`) requires an
explicit `display: flex` on any div with more than one child — it has no
implicit block layout, unlike a browser. The file's own header comment
states this rule ("Satori... requires explicit display:flex on every div
with more than one child") but this one div doesn't follow it.

Confirmed on a clean production build:

```
$ pnpm build && pnpm start
$ curl -o /dev/null -w '%{http_code}\n' http://localhost:3000/opengraph-image
```

The response fails to render — the server logs `Error: failed to pipe
response` with a Satori error naming the missing `display: flex`. This is
the root `/opengraph-image`, and the homepage's own `<meta property="og:image">`
/ `<meta name="twitter:image">` tags point at exactly this URL. Every other
OG image (`/work/[slug]`, `/writing/[slug]`) is unaffected — confirmed 200 +
valid PNG — this is isolated to the homepage's own image.

**Why it matters:** the root domain — `willmaness.com`, the URL on a resume,
an email signature, a LinkedIn post — is the single most likely link to get
shared, and it currently shows no preview image on Twitter, LinkedIn, Slack,
or iMessage. This is the exact kind of "shipped without a final check" gap
a hiring manager notices in the first five minutes, on the site's own front
door.

**Suggested fix:** add `display: "flex"` to the title `<div>`'s style
object (`flexDirection: "column"` isn't needed there since it only has
inline children, but `display: "flex"` alone satisfies Satori).

**Files:** `src/app/opengraph-image.tsx`

---

### 12. A live blog post is placeholder text — **Blocker**

`content/writing/where-the-data-moat-lives.mdx` has a full title, dek, and
"9 min read" label — everything needed to look like a finished post in
every list view — but the entire body is:

```mdx
{/* Full essay coming in Phase 1 — Will is writing this. */}

Placeholder — full essay coming soon.
```

It's dated 2026-04-01, which is *older* than the two fully-written posts
(both dated May 2026) — so this isn't a draft still being finished, it's a
post that shipped incomplete and has sat that way for over four months. It
is reachable in one click from the homepage's "Recent writing" section,
from `/writing`, and its title/dek are syndicated in full in `/feed.xml`
and `/sitemap.xml` — anyone subscribed to the feed or crawling the site sees
a real-looking entry that resolves to one sentence.

**Why it matters:** the site's stated premise (per `content/site.mdx` and
`content/projects/this-site.mdx`) is proving technical *and* writing
credibility. A visitor who clicks through on a compelling title/dek and
gets a placeholder reads as either abandoned or careless — worse for a
writing sample than simply not publishing it yet.

**Suggested fix:** either finish the essay, or remove it from
`content/writing/` (and therefore from the feed/sitemap/lists) until it's
ready — the two options the site's own "no half-finished implementations"
principle would suggest are "ship it" or "don't list it," not "list it
empty."

**Files:** `content/writing/where-the-data-moat-lives.mdx`

---

### 13. Every page overflows horizontally on mobile — the footer's contact row doesn't wrap

`src/components/layout/Footer.tsx`'s contact row (lines 13–46) lays out
"Will Maness · Boston" plus four links (email, GitHub, LinkedIn, Twitter)
in a single `flex justify-between items-center` row with no
`flex-wrap`/breakpoint handling. Measured via a headless-browser crawl at
390px width: `document.scrollWidth` is 452px — a consistent 62px overflow —
on literally every HTML route (home, about, all 10 project pages, writing
index and posts, 404). Traced to the footer specifically via
`getBoundingClientRect()`, and visually confirmed in screenshots: the
Twitter link clips off the right edge of the viewport on a phone.

**Why it matters:** this is the single most reproducible defect on the
site — it's present on every single page, not an edge case — and it's the
kind of "did you even open this on a phone" gap that undercuts an otherwise
polished, considered design.

**Suggested fix:** wrap the contact row at a mobile breakpoint — e.g. stack
"Will Maness · Boston" above the link group at `< sm`, or let the link
group wrap (`flex-wrap`) with reduced gap, matching whatever pattern
`Nav.tsx` already uses for its own mobile handling.

**Files:** `src/components/layout/Footer.tsx`

---

### 14. Project pages are server-rendered per-request, contradicting the site's own "static-by-default" narrative

`src/app/work/[slug]/page.tsx:14` sets `export const dynamic =
"force-dynamic"` for the *entire* route, even though the same file defines
`generateStaticParams` (line 20) — a static param list wired to a route
that's forced dynamic anyway. `pnpm build`'s route table confirms it:
`ƒ /work/[slug]` (server-rendered on demand) versus `● /writing/[slug]`
(prerendered as static HTML).

This directly contradicts `content/projects/this-site.mdx`'s own copy:

> Lighthouse 95+ across the main routes isn't an optimization effort; it's
> the default behavior of the architecture.
> ...the static-by-default posture.

Only two projects (`boston-civic-data`, `ember`) genuinely need
request-time data for their live-data widgets — client components that
fetch their own API routes independently of the page shell, so the page
*shell* itself doesn't need to be dynamic even for those two. Everything
else — `this-site`, `vienna-trainer`, `chess`, `spx-dashboard`,
`project-stellar`, `vendor-feed` (the static narrative, not
`vendor_feed`), `palette`, `music-analyzer` — is pure MDX content with no
reason to skip static generation.

**Why it matters:** this is the page a technical hiring manager is most
likely to read closely, on a site whose own writeup makes a specific,
checkable performance claim about exactly this route type. The claim isn't
false in spirit (Lighthouse still likely scores well on a fast dev server),
but the *mechanism* described — static generation — isn't what's actually
running for this route.

**Suggested fix:** remove the blanket `force-dynamic` from
`src/app/work/[slug]/page.tsx` and let `generateStaticParams` do its job;
only routes with genuinely request-time content (the two DB-backed
dashboards, if their *page shells* — not just their client widgets — read
live data server-side) should opt into `force-dynamic` individually.

**Files:** `src/app/work/[slug]/page.tsx`

---

### 15. Pipeline Dashboard has four different, disagreeing answers to "what does it track" — supersedes draft 10

Building on finding 10 (still open, drafted in PR #245): the mismatch is
worse than a copy/reality gap in one place. Four different sources of truth
in this feature each claim something different:

1. **`content/projects/pipeline-dashboard.mdx`** — copy says "Boston 311
   and Chess tournament tracking," plus a "What's next" line promising a
   "Chess pipeline... pings the Lichess API hourly."
2. **`src/lib/PipelineStatusService.ts`**'s own header comment — says
   "pipeline_runs rows drive the **311 and chess** cards" (line 3) — but
   the SQL two lines below it queries `WHERE pipeline IN ('311', 'ember')`.
   No chess, and the comment doesn't even match its own file's code.
3. **`getPipelineStatuses`'s actual return shape** (DB connected) —
   `['311', 'vendor-feed', 'ember']`.
4. **`src/app/api/pipeline-status/route.ts`'s no-DB fallback** (lines
   33–36) — emits only `['311', 'vendor-feed']`. No `ember`, no `chess`.
   A third distinct shape.

`PipelineId` in `src/components/projects/pipeline-dashboard/types.ts` is
`'311' | 'vendor-feed' | 'ember'` — chess was never a member of the type,
so `PipelineCard.tsx`'s `chess` entries in its `DATA_SOURCE` and
`DISPLAY_NAMES` label maps are unreachable dead code.

Confirmed on a clean `pnpm build && pnpm start`: the rendered page shows
"BOSTON 311" and "VENDOR FEED" cards, directly under a paragraph promising
311-and-chess tracking.

**Why it matters:** this is a page explicitly *about* pipeline health and
correctness, whose own internal accounting doesn't agree with itself in
three different files, on top of the public copy not agreeing with any of
them. That's a strong signal to a technical reader that the feature's
scope changed mid-build and nothing downstream caught up — worth fixing
comprehensively rather than patching just the MDX copy.

**Suggested fix:**
- Rewrite the intro paragraph and "What's next" section of
  `pipeline-dashboard.mdx` to describe the pipelines actually tracked
  (311, Vendor Feed, EmberBrief), dropping the Lichess/chess framing.
- Fix the stale comment in `PipelineStatusService.ts` (drop "and chess").
- Reconcile the no-DB fallback in `route.ts` to include `ember` (matching
  the real 3-pipeline shape) or document why it deliberately omits it.
- Remove the dead `chess` entries from `PipelineCard.tsx`'s label maps.

**Files:**
- `content/projects/pipeline-dashboard.mdx`
- `src/lib/PipelineStatusService.ts`
- `src/app/api/pipeline-status/route.ts`
- `src/components/projects/pipeline-dashboard/PipelineCard.tsx`
- `src/components/projects/pipeline-dashboard/types.ts`

---

### 16. Hardcoded hex colors violate the project's own "tokens are the source of truth" rule

`CLAUDE.md`'s workflow section states: "Tokens are the single source of
truth — no raw hex in components, no magic numbers." Most status colors do
follow this (`var(--accent)` for success, `var(--clay)` for failure), but
the "in-progress/warning" yellow is hardcoded raw hex, absent from the
token system entirely:

- `src/components/projects/boston-civic-data/DepartmentCard.tsx:16` —
  `yellow: "#C49A2A"`
- `src/components/projects/boston-civic-data/DepartmentCard.tsx:22` —
  `yellow: "#F5EDD4"`
- The same pattern repeats in `StackList.tsx` and `GameModal.tsx`.

**Why it matters:** this is a rule the project's own contributor
instructions state explicitly, and the repo is public specifically to
demonstrate disciplined engineering practice — a reviewer who reads
`CLAUDE.md` and then greps the codebase will find the rule broken in the
first component that needs a third status color.

**Suggested fix:** add a `warning`/`yellow` pair to `src/lib/tokens.ts`
(matching the existing accent/clay pattern) and reference it from all four
call sites instead of the raw hex.

**Files:**
- `src/components/projects/boston-civic-data/DepartmentCard.tsx`
- `src/components/projects/boston-civic-data/StackList.tsx`
- `src/components/projects/chess/GameModal.tsx`
- `src/lib/tokens.ts`

---

### 17. No route-level error boundaries anywhere in the app

There is no `error.tsx` or `global-error.tsx` anywhere under `src/app/`.
The manual try/catch fallbacks in `vendor_feed/page.tsx` and the client
widgets are well done (see findings 01/04, now fixed), but they're
per-component discipline, not a safety net — any *other* server component
that throws (a bad MDX import, an unexpected data shape from a route not
yet hardened) falls through to Next's bare default error screen with no
site chrome, the same failure mode findings 01/02 originally described.

**Suggested fix:** add a root `src/app/error.tsx` (client component,
reusing `Container`/`Nav`/`Footer` the same way `not-found.tsx` does) as a
last-resort net, independent of the per-page try/catch work already done.

**Files:** `src/app/error.tsx` (new)

---

### 18. Confusing near-duplicate URLs: `/work/vendor-feed` vs `/work/vendor_feed`

Two live, public routes differ by exactly one character — a hyphen versus
an underscore — for related but different things: `/work/vendor-feed` is
the MDX-driven project narrative; `/work/vendor_feed` is the standalone
live dashboard (the same legacy route from finding 01, now fixed rather
than removed). Both are real, reachable, and easy to mistype into each
other.

**Suggested fix:** rename `/work/vendor_feed` to something unambiguous
(e.g. `/work/vendor-feed/live` or `/vendor-feed-dashboard`) now that it's
staying rather than being deleted, so the two URLs aren't one keystroke
apart.

**Files:** `src/app/work/vendor_feed/` (rename)

---

### 19. Small content nits from this pass (bundled — not each worth a separate ticket)

- **Typo:** "continously" → "continuously" —
  `content/writing/ai-makes-you-busier.mdx:31`.
- **Stale comment:** `src/app/dev/components/page.tsx:4` says "The
  underscore prefix on `_dev` tells Next.js to exclude it from route
  generation" — the actual directory is `dev`, no underscore. The
  `NODE_ENV` guard in the same file works correctly (confirmed 404 in a
  production build); only the comment is wrong.
- **No-op frontmatter field:** `content/writing/ai-makes-you-busier.mdx:6`
  sets `draft: false`. `writingSchema` in `src/lib/content-schemas.ts` has
  no `draft` field — Zod silently strips it, so setting `draft: true` on a
  future post would not hide it from any list, feed, or sitemap. Either
  wire it in for real or remove the field so it doesn't look load-bearing.
- **Unsourced, oddly precise metric:** "manual analyst baseline is
  approximately 47 minutes" — `content/projects/ember.mdx:57` — reads as a
  real benchmark; worth a one-line note on how it was measured, or softened
  if it's an estimate.

## Not filed as issues

- `va.vercel-scripts.com` console errors and the Chess Tracker's Lichess
  fetch failure in the crawl — this sandbox has no route to Vercel's
  telemetry endpoints or to `lichess.org`; carried over from every prior
  pass, still not reproducible as a real issue.
- The Next.js dev-mode indicator element present on every page during
  `pnpm dev` — dev-only tooling, not shipped in production.
- `src/lib/music-analyzer/` (Spotify client, feature extractor, tests) has
  zero references outside its own directory on current `main` — but #215,
  #243 (Billboard pipeline/cron), and #246 (lookup/compare/top100 views)
  are open, green PRs that wire it in. Likely to resolve itself once those
  merge; flagging only so it doesn't get missed if they stall the way
  #234–#241 sat unmerged for weeks.
- `/work/pipeline-dashboard` never reaches a `networkidle` wait in the
  crawler — expected, its SSE connection is deliberately long-lived
  (30s re-emit + 25s keepalive ping). Confirmed clean with a `load`-based
  wait instead.

## Bottom line

The backlog this series has been tracking since 07-11 is genuinely clear —
all 8 original bugs verified fixed, zero regressions, clean
build/lint/test. But three weeks of this exact QA loop sitting unreviewed
(PR #245) let two new, more visible issues go unnoticed in the meantime:
a broken share image on the site's own root URL, and a placeholder essay
that's been live for over four months. Recommend treating 11 and 12 as the
priority items in this batch — they're both "first five minutes" visible —
then 13–18 as they fit; 19 whenever convenient.
