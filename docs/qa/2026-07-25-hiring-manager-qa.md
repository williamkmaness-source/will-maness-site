# QA pass — second follow-up, reading the site as a VP-of-Product hiring manager

_2026-07-25. Second one-week follow-up to the 2026-07-11 pass
(`docs/qa/2026-07-11-hiring-manager-qa.md`, PR #232) and the 2026-07-18 pass
(`docs/qa/2026-07-18-hiring-manager-qa.md`, PR #233). Re-ran a clean
`pnpm install && pnpm build && pnpm start` against today's `main`
(`a15079a`) and crawled all published routes at desktop (1440px) and mobile
(390px) with a headless browser, capturing console errors and failed
requests, cross-checked against source._

## Headline: the fixes exist now — they're just not merged

This is the most important change since last week, and it's not a code
finding. Between 07-18 and today, **8 of the 9 findings got real fix PRs**
(#234–#241, one per finding, companions to the 07-18 QA follow-up PR #233).
CI is green on all of them (Vercel preview deploys succeeded), none have
review comments, and none have been merged. Only #240 (finding 07, the
unused scaffold SVGs) landed on `main` — a one-line `rm`.

So functionally, `main` today is identical to `main` on 07-18 plus that one
cleanup. Findings 1–6 and 8 all still reproduce exactly as originally
documented, for the third straight week, even though working fixes for all
of them have been sitting reviewable since 07-18:

| # | Finding | Fix PR | Status |
| - | ------- | ------ | ------ |
| 01 | `/work/vendor_feed` 500 | #234 | Open, green CI, unreviewed |
| 02 | `/ember` duplicate, indexable | #236 | Open, green CI, unreviewed |
| 03 | `/about` double `<h1>` | #238 | Open, green CI, unreviewed |
| 04 | Raw error string in widgets | #235 | Open, green CI, unreviewed |
| 05 | No in-progress indicator | #237 | Open, green CI, unreviewed |
| 06 | No custom 404 | #239 | Open, green CI, unreviewed |
| 07 | Unused scaffold SVGs | #240 | **Merged 2026-07-19** |
| 08 | Stale `MEMORY.md` / missing quiz | #241 | Open, green CI, unreviewed |
| 09 | Sable positioning (discussion) | — | No PR filed (by design — editorial call, not a bug) |

The gap here isn't engineering — it's the merge queue. Recommend treating
#234–#239 and #241 as a batch to review and merge this week; none of them
touch overlapping files (confirmed by re-reading each diff), so they can go
in in any order without conflicts.

## Findings 1, 2, 3, 6: unchanged, re-confirmed

Re-ran the original repro steps against today's build. All reproduce
exactly as before:

- **`/work/vendor_feed` — HTTP 500.** `curl -o /dev/null -w '%{http_code}'
  http://localhost:3000/work/vendor_feed` → `500`. Same `No Postgres
  connection string found` crash, same bare unstyled error page. Fix ready
  in #234.
- **`/ember` — 200, no `noindex`.** `curl -s .../ember | grep 'name="robots"'`
  → no match. Still a public, indexable duplicate of `/work/ember`. Fix
  ready in #236.
- **`/about` — two `<h1>` elements.** `curl -s .../about | grep -o
  '<h1[^>]*>'` returns two matches: the page's real `<h1>About</h1>` and the
  stray MDX heading. `content/site.mdx` unchanged. Fix ready in #238.
- **No custom 404.** `src/app/not-found.tsx` still doesn't exist;
  `/nonexistent-page-test-404` still falls through to Next's bare default.
  Fix ready in #239.

## Findings 4, 5, 8: unchanged, re-confirmed, no new material this week

- **#4, raw error-string copy.** Source unchanged in `StaffingDashboard.tsx`,
  `EmberDashboard.tsx`, and `RequestTypeBreakdown.tsx` — all three still
  `throw new Error(\`API error ${res.status}\`)` and render it verbatim on
  fetch failure. Fix ready in #235. (`#210`, the expired Ember weather key
  that made this a live-production risk rather than a sandbox artifact, is
  also still open.)
- **#5, no in-progress indicator.** `WorkCard.tsx` unchanged — `status` still
  only drives opacity for `"forthcoming"`, a value nothing uses.
  `in-progress` count holds at 7 of 10 (Boston civic data, EmberBrief,
  Pipeline Dashboard, Seasonal Color Palette, This site, Vendor intelligence
  feed, Sable). Fix ready in #237.
- **#8, stale process docs.** `MEMORY.md` still opens with `_Last updated:
  2026-05-06_` and still lists Phase 1 as "🟡 Ready to start." Fix ready in
  #241.

## Finding 9: unchanged

`project-stellar.mdx` (Sable) frontmatter unchanged — same tags, still not
`featured`. Still an open editorial question, not a code fix; no PR
expected unless Will decides which of the three options in
`issue-drafts/09-sable-positioning.md` he wants.

## New this pass: none

Extended the crawl beyond the original 9 findings' scope this week —
`/work/pipeline-dashboard`'s Server-Sent Events connection (by design, keeps
the connection open for live updates, which is why a `networkidle` wait
times out on that route specifically) and the Seasonal Color Palette widget
were both spot-checked again for the same failure classes (duplicate
headings, raw error text, crash-on-bad-input). Both clean, as in the 07-18
pass. No new findings surfaced. The `_vercel/insights` and
`_vercel/speed-insights` 404s and the `lichess.org` connection resets in the
crawl logs are the same sandbox-has-no-outbound-network artifacts noted in
both prior reports — not reproducible against the live site.

## Bottom line

No regressions. No new findings. One of nine original findings is fixed on
`main` (07); the other eight are unchanged for a third week running, but
seven of those eight now have a ready, green-CI fix sitting in an unmerged
PR. The single highest-leverage action available right now isn't more QA —
it's reviewing and merging #234–#239 and #241.
