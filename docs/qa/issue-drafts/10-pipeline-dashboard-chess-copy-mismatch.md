---
title: "Pipeline Dashboard's copy describes chess tracking it doesn't do"
labels: bug, content, polish
---

## Problem

`/work/pipeline-dashboard`'s intro paragraph, its work-index card summary, and its
"What's next" roadmap section all describe the dashboard as tracking "Boston 311
and Chess tournament tracking" pipelines, and specifically promise a future
"Chess pipeline — a Vercel Cron job pings the Lichess API hourly."

The dashboard doesn't track chess at all. `PipelineStatusService.getPipelineStatuses`
queries `pipeline_runs WHERE pipeline IN ('311', 'ember')` plus a separate
`vf_raw_pages` aggregation for Vendor Feed, and `PipelineId` in
`src/components/projects/pipeline-dashboard/types.ts` is
`'311' | 'vendor-feed' | 'ember'` — there's no `'chess'` member in the type at
all. The two cards that actually render (confirmed both against the no-DB
fallback in `route.ts` and by reading the real-DB query) are **311** and
**Vendor Feed**, with **EmberBrief** as the third when a DB is connected. Neither
Vendor Feed nor EmberBrief is mentioned anywhere in the page's descriptive copy.

`PipelineCard.tsx` still has a vestigial `chess` entry in its `DATA_SOURCE` and
`DISPLAY_NAMES` label maps — dead code, unreachable given `PipelineId` — which
looks like a leftover from before the tracked pipeline set changed from
(311, chess) to (311, vendor-feed, ember).

Verified on a clean `pnpm build && pnpm start`: the rendered page shows a
"BOSTON 311" card and a "VENDOR FEED" card directly below a paragraph that reads
"...the Lichess Broadcasts API for chess tournaments. This dashboard shows
whether those pipelines are healthy."

This is a promise/reality mismatch on a page explicitly about pipeline health and
correctness — exactly the kind of detail a technical reader checks project
writeups against their actual output for.

## Suggested fix

- Rewrite the intro paragraph and "What's next" section of
  `content/projects/pipeline-dashboard.mdx` to describe the pipelines actually
  tracked (311, Vendor Feed, EmberBrief), dropping the Lichess/chess framing —
  or wire a real chess pipeline into `PipelineId`/`getPipelineStatuses` if
  chess tracking is still the intent.
- Remove the dead `chess` entries from `PipelineCard.tsx`'s `DATA_SOURCE` and
  `DISPLAY_NAMES` maps once the copy is fixed.

## Files

- `content/projects/pipeline-dashboard.mdx`
- `src/components/projects/pipeline-dashboard/PipelineCard.tsx`
- `src/components/projects/pipeline-dashboard/types.ts`
- `src/lib/PipelineStatusService.ts`

## Repro

1. `pnpm build && pnpm start`
2. Visit `/work/pipeline-dashboard`
3. Read the intro paragraph and "What's next" section (chess), then compare to
   the two rendered status cards (Boston 311, Vendor Feed)
