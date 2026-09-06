# QA pass — reading the site as a VP-of-Product hiring manager

_2026-09-06. Sixth pass in this series, following 2026-07-11
(`2026-07-11-hiring-manager-qa.md`), 2026-07-18, 2026-07-25 (PR #242),
2026-08-01 (PR #245, still open), 2026-08-23 (PR #248, still open), and
2026-08-30 (`2026-08-30-hiring-manager-qa.md`, PR #249, still open). Ran a
clean `pnpm install`, `pnpm build`, `pnpm start`, `pnpm exec vitest run`,
and `pnpm lint` against today's `main`, and independently re-verified every
open finding against source and the running server rather than trusting
last week's report._

## Headline: `main` hasn't moved in five weeks, and there are now three open QA PRs saying the same thing

`main` is still at `dd40435` — unchanged since 2026-08-01. That's five
straight weeks of QA passes (#242, #245, #248, #249) documenting the same
backlog while nothing lands. Worse, the backlog itself hasn't been
converging: #249 explicitly asked to close #245 and #248 as superseded once
it was reviewed, and none of the three has been touched since:

| PR | Pass date | State |
| -- | --------- | ----- |
| #245 | 2026-08-01 | Open 5 weeks, unreviewed |
| #248 | 2026-08-23 | Open 2 weeks, unreviewed, Vercel check failing |
| #249 | 2026-08-30 | Open 1 week, unreviewed — asked to supersede #245/#248 |

This pass adds a fourth. All four are docs-only (new/updated files under
`docs/qa/`), so there is nothing to conflict between them or against
`main` — but four overlapping QA submissions sitting in the queue is itself
now a bigger signal than any individual finding below. **Recommend: merge
this PR, close #245, #248, and #249 without merging (all three are fully
superseded by this one), and treat findings 11 and 12 as this week's actual
work** — both are one-line/one-file fixes that have now been sitting ready
for two to five weeks apiece while live on `willmaness.com`.

## Re-confirmed end-to-end: the two blocker findings are unchanged

- **Broken homepage share image (finding 11).** Read
  `src/app/opengraph-image.tsx` directly: the title `<div>` (lines 38–52)
  still wraps two children — a bare text node and a `<span>` — with no
  `display` set, even though the file's own header comment states the rule
  ("Satori... requires explicit display:flex on every div with more than
  one child"). Confirmed live: `pnpm build && pnpm start`, then
  `curl http://localhost:3100/opengraph-image` fails, and the server log
  shows the identical Satori error (`Expected <div> to have explicit
  "display: flex"...`). Third consecutive weekly pass this has reproduced
  byte-for-byte. `willmaness.com`'s root URL has now shown no link-preview
  image on any platform (LinkedIn, Slack, iMessage, Twitter) for at least
  three weeks running.
- **Placeholder essay still live and still syndicated (finding 12).**
  `content/writing/where-the-data-moat-lives.mdx` is unchanged: full title,
  dek, and "9 min read" label over a one-sentence placeholder body, dated
  2026-04-01 — now over five months old. Confirmed still syndicated in full
  in `feed.xml` (`curl http://localhost:3100/feed.xml` returns the full
  title/dek/pubDate block) and still reachable from the homepage's "Recent
  writing" and `/writing`.

## Re-confirmed unchanged: findings 13–19

Checked each directly against source and, where applicable, the running
server — all reproduce exactly as documented in the 08-23/08-30 passes,
with no drift:

- **13 — mobile footer overflow.** `Footer.tsx`'s contact row is still a
  bare `flex justify-between items-center` with no `flex-wrap` or
  breakpoint handling.
- **14 — `/work/[slug]` force-dynamic.** Today's `pnpm build` route table
  still shows `ƒ /work/[slug]` even though the same file defines
  `generateStaticParams`, versus `● /writing/[slug]`, which is prerendered.
- **15 — Pipeline Dashboard's four disagreeing sources of truth.**
  `PipelineCard.tsx` and its test file still carry dead `chess`
  references, `PipelineId` still has no `chess` member, and the MDX copy
  still promises a Lichess pipeline that doesn't exist in code.
- **16 — hardcoded hex outside the token system.** `#C49A2A`/`#F5EDD4` are
  still hardcoded in `DepartmentCard.tsx`. (Note: this pass could not find
  the same literal hex pair in `StackList.tsx` or `GameModal.tsx` as the
  08-23 draft states — worth a second look when this is filed, since the
  underlying "no warning token exists" problem is confirmed regardless.)
- **17 — no error boundary.** Still no `src/app/error.tsx` or
  `global-error.tsx` anywhere under `src/app/`.
- **18 — `/work/vendor-feed` vs `/work/vendor_feed` naming collision.**
  Both routes are still live and one character apart; confirmed
  `/work/vendor_feed` still returns 200 with the designed fallback (no DB
  configured in this environment).
- **19 — content nits bundle.** All four still present: the "continously"
  typo in `ai-makes-you-busier.mdx`, the stale `_dev` comment in
  `src/app/dev/components/page.tsx`, the no-op `draft: false` field (still
  not wired into `writingSchema`), and the unsourced "47 minutes" metric in
  `ember.mdx`.

## Findings 01–08: still fixed, no regressions

`pnpm exec vitest run` (471/471), `pnpm lint`, and `pnpm build` are all
clean. Spot-checked source for all eight original fixes (vendor-feed 500
guard, `/ember` noindex, single `<h1>` on `/about`, widget fallback copy,
work-card status indicators, custom 404, removed scaffold SVGs, refreshed
`MEMORY.md`) — all merged and intact, matching every prior pass since
07-25.

## Finding 09: unchanged

Sable's positioning (`project-stellar.mdx`) is unchanged — still an open
editorial call for Will, not a bug.

## No new findings this pass

Zero commits landed on `main` in five weeks, so there was no new surface to
find problems in. Extended the check to the full test suite and lint (both
clean) and re-read every open finding's source directly rather than
trusting prior reports' conclusions — everything above was independently
re-derived, not copy-pasted forward.

## Bottom line

The engineering diagnosis has been complete and stable since 08-23: two
one-file blocker fixes (11, 12) and seven lower-priority polish items,
all documented with suggested fixes in `docs/qa/issue-drafts/`. The actual
risk is entirely in the review queue — four QA PRs, a broken share image on
the site's own root URL, and a five-month-old placeholder post live in
production, none of it a hard technical problem. Recommend merging this PR,
closing #245/#248/#249, and spending fifteen minutes on findings 11 and 12
before anything else.
