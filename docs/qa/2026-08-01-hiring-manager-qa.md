# QA pass — reading the site as a VP-of-Product hiring manager

_2026-08-01. Follow-up to 2026-07-11 (`2026-07-11-hiring-manager-qa.md`), 2026-07-18
(`2026-07-18-hiring-manager-qa.md`), and 2026-07-25 (PR #242, which reported 8 of 9
original findings still open despite fix PRs #234–#241 being ready). Ran a clean
`pnpm install && pnpm build && pnpm start` against today's `main`, re-crawled all
published routes at desktop (1440px) and mobile (390px) with a headless browser
(console errors, failed requests, screenshots), re-read the relevant source for
every prior finding, and ran `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm test`._

## Headline: the backlog is clear

Between the 07-25 pass and today, #234, #235, #236, #237, #238, #239, and #241 all
merged (#240 had already merged 07-19). That's all 8 bug/chore findings from the
original 07-11 report. Re-verified every one directly against today's build:

| # | Finding | Verified fix |
| - | ------- | ------------ |
| 01 | `/work/vendor_feed` 500 | Now guards the Postgres read in a try/catch; returns `200` and renders the page's designed empty/error state instead of crashing. `src/app/work/vendor_feed/page.tsx` |
| 02 | `/ember` indexable duplicate | Now ships `robots: { index: false, follow: true }`; confirmed `<meta name="robots" content="noindex, follow">` in the response. |
| 03 | `/about` double `<h1>` | `content/site.mdx`'s stray `#` line now renders as a plain paragraph; confirmed exactly one `<h1>` in the DOM. |
| 04 | Raw error string in widgets | `StaffingDashboard`, `EmberDashboard`, and `RequestTypeBreakdown` all now log the raw error to `console.error` and render a fixed user-facing sentence ("Live data temporarily unavailable…" / "Could not load fire data…"). Confirmed both in source and by screenshot on `/work/ember` (DB unavailable in this sandbox — the fallback state is exactly what a visitor would see on a real transient failure). |
| 05 | No in-progress indicator | `WorkCard.tsx` now renders a moss dot + "In progress" label for `status: "in-progress"` and a plain "Forthcoming" label for that status. Confirmed on `/work` — all 7 in-progress projects show it, `/` (homepage Selected Work) too. |
| 06 | No custom 404 | `src/app/not-found.tsx` exists, renders inside the normal nav/footer frame with a one-line message and a link home. Confirmed by screenshot. |
| 07 | Unused scaffold SVGs | `public/` now contains only `will-maness-headshot.jpg`. |
| 08 | Stale `MEMORY.md` / missing quiz | `MEMORY.md` now reflects Phases 0–3 as done and the post-MVP project roster; `docs/quizzes/phase-1.md` exists. |

No regressions from any of these fixes — `pnpm build`, `tsc --noEmit`, `pnpm lint`
(all clean), and `pnpm test` (471/471 passing across 30 files) all pass on current
`main`.

**Finding 09** (Sable's positioning relative to the site's technical-fluency
narrative) was always flagged as an editorial call, not a bug — `project-stellar.mdx`
is unchanged. Still worth a deliberate decision; not re-filing as a new item, see
`issue-drafts/09-sable-positioning.md` for the still-current options.

**Housekeeping:** PR #242 (the 07-25 follow-up) is now stale — it reports 8/9
findings open, which was accurate when written but is no longer true now that
#234–#241 have merged. Recommend closing #242 without merging; this report
supersedes it.

## New finding this pass

### 10. Pipeline Dashboard's own copy doesn't match what it tracks (Medium)

`/work/pipeline-dashboard`'s intro paragraph, the homepage/work-index card summary,
and the "What's next" roadmap section all describe the dashboard as tracking
**"Boston 311 and Chess tournament tracking"** pipelines:

> The embedded apps on this site pull from live data sources: the Boston CKAN API
> for 311 data and the Lichess Broadcasts API for chess tournaments. This dashboard
> shows whether those pipelines are healthy.
>
> ...**Chess pipeline** — a Vercel Cron job pings the Lichess API hourly and writes
> a health record to KV.

But the actual shipped cards — confirmed both in the fallback (no-DB) render and in
`PipelineStatusService.getPipelineStatuses`, which queries
`pipeline_runs WHERE pipeline IN ('311', 'ember')` and a separate `vf_raw_pages`
aggregation — are **311, Vendor Feed, and EmberBrief**. Chess isn't wired in
anywhere in the data layer (`PipelineId` in `types.ts` is
`'311' | 'vendor-feed' | 'ember'` — no `'chess'` member), and neither Vendor Feed
nor EmberBrief is mentioned anywhere in the page's descriptive copy. `PipelineCard.tsx`
still carries a vestigial `chess` entry in its label maps (`DATA_SOURCE`,
`DISPLAY_NAMES`) that the type system makes unreachable — a leftover from before the
tracked pipeline set changed.

Screenshot confirms the live page: a "BOSTON 311" card and a "VENDOR FEED" card,
directly under a paragraph promising "311 data and... chess tournaments."

This is exactly the kind of promise/reality mismatch the site's own audience is
primed to notice — a technical hiring manager reading a project writeup line by
line, then looking at the actual output, is the target reader for this page. It
reads as if the project's scope changed mid-build and the writeup never caught up.

**Suggested fix:** rewrite the intro paragraph and "What's next" section in
`content/projects/pipeline-dashboard.mdx` to describe the pipelines actually
tracked (311, Vendor Feed, EmberBrief) and drop the Lichess/chess framing, or
wire chess in for real if that's still the intent. Also remove the dead `chess`
entries from `PipelineCard.tsx`'s label maps once the copy is fixed, since they're
unreachable given `PipelineId`.

**Files:**
- `content/projects/pipeline-dashboard.mdx`
- `src/components/projects/pipeline-dashboard/PipelineCard.tsx`
- `src/lib/PipelineStatusService.ts` (source of truth for which pipelines are real)

## Not filed as issues

- `va.vercel-scripts.com` / `_vercel/insights` and `_vercel/speed-insights` script
  failures in the crawl logs — sandbox has no outbound network to Vercel's
  analytics CDN; not reproducible as a real issue, won't occur in production.
  Same for `lichess.org` `ERR_CONNECTION_RESET` on `/work/chess` — carried over
  from every prior pass, still a sandbox network limitation, not a code issue.
- `/work/pipeline-dashboard` never reaches Playwright's `networkidle` — expected;
  its SSE connection to `/api/pipeline-status` is deliberately long-lived
  (re-emits every 30s + a 25s keepalive ping). Confirmed with a `load`-based wait
  instead: the page renders cleanly, one `<h1>`, no console errors beyond the
  expected no-DB 404s on internal Next.js RSC prefetches.
- 311/Ember 503s in the crawl (`StaffingDashboard`, `EmberDashboard` widgets) are
  this sandbox having no Postgres connection string — expected, and the whole
  point of finding 04's fix is that they degrade gracefully instead of crashing,
  which they now visibly do.
- `docs/build-log.md` / `MEMORY.md` currency beyond finding 08 — `MEMORY.md` is
  dated 2026-07-18 and doesn't mention the music-analyzer pipeline work (#215/#231,
  PR #243, still open) or the palette swatch-picker polish (#244, merged). Noting
  only — this is a much smaller gap than the original finding (weeks, not months,
  and the phase-status table itself is still accurate), not worth a separate issue.

## Bottom line

The findings backlog from three weeks of QA passes is now actually clear — 8 real
fixes merged, zero regressions, clean `build`/`tsc`/`lint`/`test`. One new,
narrowly-scoped content/code mismatch found this pass (pipeline dashboard's chess
copy vs. its real data sources). Recommend: close stale PR #242, approve and file
issue draft 10 from this PR, and make a call on 09 (Sable) whenever convenient —
it's the only other open item and it isn't a bug.
