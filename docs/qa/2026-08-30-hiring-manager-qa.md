# QA pass — reading the site as a VP-of-Product hiring manager

_2026-08-30. Fifth pass in this series, following 2026-07-11
(`2026-07-11-hiring-manager-qa.md`), 2026-07-18 (`2026-07-18-hiring-manager-qa.md`),
2026-07-25 (`2026-07-25-hiring-manager-qa.md`, PR #242), and 2026-08-23
(`2026-08-23-hiring-manager-qa.md`, PR #248 — still open, unreviewed, with
failing Vercel CI). Ran a clean `pnpm install`, `pnpm build && pnpm start`,
`pnpm lint`, and `pnpm test` against today's `main`, and independently
re-verified the highest-severity open findings by hitting the live routes
and re-reading the relevant source._

## Headline: `main` has been frozen for a month, while two live "first five minutes" defects sit unfixed

`main` is at `dd40435` — the exact same commit as when PR #248 was written a
week ago, and the same commit the 08-23 pass itself reported as unchanged
since 08-01. **Four weeks with zero commits to `main`**, despite three
generations of QA work (PR #242, #245, #248) documenting real, mostly
trivial-to-fix bugs the whole time. This pass isn't finding new code
problems — there's no new code to find them in — it's confirming that
what's already been found and written up is still broken, and flagging that
the review queue itself is now the site's biggest liability.

Two open PRs currently carry this backlog:

| PR | What it is | State |
| -- | ----------- | ----- |
| #245 | 08-01 pass: findings 01–08 verified fixed, drafted finding 10 | Open 4 weeks, unreviewed |
| #248 | 08-23 pass: re-verified 01–10, added findings 11–19 | Open 1 week, unreviewed, **Vercel CI failing** |

Both are docs-only PRs (new/updated files under `docs/qa/`) — no application
code changes, so there's nothing to conflict between them or against `main`.
Per the 08-23 report's own recommendation, #248 supersedes #245; this pass
in turn brings that same content forward into a fresh PR against current
`main`; recommend closing #245 and #248 without merging once this one is
reviewed, and merging this one instead, so the backlog collapses into a
single up-to-date, green-CI submission rather than three overlapping ones.

## PR #248's failing Vercel deployment doesn't reproduce locally

Before treating #248's findings as current, checked whether its failing
"Vercel" check (`Deployment has failed`) meant something on `main` itself
had broken. It doesn't appear to: a fresh `pnpm install && pnpm build` on
today's `main` compiles cleanly (`✓ Compiled successfully`, all 37 routes
generated), and `pnpm lint` and `pnpm test` (471/471) both pass with no
errors. #248's diff is also docs-only, so there's no application code in
that PR for a build to fail on. This sandbox has no access to Vercel's
dashboard or CLI to pull the actual deployment logs, so the specific cause
is unconfirmed — but "docs-only PR, clean local build" points at something
environmental (a preview-deployment config or secret) rather than a real
code regression. Worth a quick look at the linked Vercel inspect output
before assuming otherwise, since a genuinely broken deploy pipeline would
outrank everything else in this report.

## Independently re-confirmed: the two blocker findings from 08-23 are still live

Rather than re-deriving all 19 prior findings from scratch — the code
hasn't moved, so that would just restate #248's own re-verification — this
pass directly re-ran the two highest-severity repros end to end:

- **Broken homepage share image.** `curl http://localhost:3000/opengraph-image`
  against a clean `pnpm build && pnpm start` still fails; the server log
  shows the identical Satori error: `Expected <div> to have explicit
  "display: flex"...`, tracing to the same untouched title `<div>` in
  `src/app/opengraph-image.tsx`. `willmaness.com`'s root URL — the one most
  likely to land on a resume or in a LinkedIn post — has now shown no share
  preview across two consecutive weekly passes, for a fix that's a single
  added style property. (Finding 11 — `docs/qa/issue-drafts/11-og-image-broken-satori-display.md`.)
- **Placeholder essay still live and still syndicated.**
  `content/writing/where-the-data-moat-lives.mdx` is unchanged: full title,
  dek, and "9 min read" label, one-sentence placeholder body, and its
  title/dek still go out in full in `/feed.xml` and `/sitemap.xml`. Dated
  2026-04-01, this is now very nearly five months of a real-looking, empty
  post being one click from the homepage. (Finding 12 —
  `docs/qa/issue-drafts/12-placeholder-blog-post-live.md`.)

Also spot-checked findings 13, 14, 16, 17, and 18 directly against source
(mobile footer's missing `flex-wrap`, `force-dynamic` on `/work/[slug]`,
the hardcoded `#C49A2A`/`#F5EDD4` hex pair, the missing `src/app/error.tsx`,
and the `vendor-feed`/`vendor_feed` naming collision) — all reproduce
exactly as documented on 08-23, byte-for-byte unchanged. Full detail for
every finding lives in the per-issue drafts in `docs/qa/issue-drafts/`,
each now carrying a dated 2026-08-30 re-check note.

## Findings 01–09: still fixed, no regressions

Independently re-confirmed (via source, not just trusting last week's
report) that all eight bug/chore fixes from the original 07-11 pass remain
merged and intact on today's `main`: the vendor-feed 500 guard, `/ember`'s
`noindex`, the single `<h1>` on `/about`, the widgets' designed fallback
copy, `WorkCard`'s status indicator, the custom 404, the removed scaffold
SVGs, and `MEMORY.md`'s refreshed status table. `pnpm test` (471/471),
`pnpm lint`, and `pnpm build` are all clean. Finding 09 (Sable's
positioning) remains an open editorial call, not a bug — no change expected
here without a decision from Will.

## No new findings this pass

Nothing to add beyond what #248 already documented (findings 10–19) — the
code is identical to a week ago. The only thing that changed between 08-23
and today is that a week passed with no review action.

## Bottom line

The engineering backlog itself is small and well-understood: two blocker
fixes that are each a few lines, plus seven lower-priority polish/content
items, all fully diagnosed with suggested fixes ready to hand to whoever
implements them. The actual risk to the site right now is that this exact
QA loop has now produced three unreviewed PRs (#242's successors #245 and
#248, plus this one) over four weeks while a broken share image and a
placeholder blog post stay live in production. Recommend, in order:
review and merge this PR (closing #245 and #248 without merging, per their
own superseding notes), then treat findings 11 and 12 as this week's actual
priority — both are one-file, low-risk fixes with the highest visibility
to exactly the audience this site is built for.
