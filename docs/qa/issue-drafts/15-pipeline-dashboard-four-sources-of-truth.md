---
title: "fix(pipeline-dashboard): reconcile four disagreeing sources of truth on tracked pipelines"
labels: bug, content, polish
---

## Problem

Supersedes draft 10 (`10-pipeline-dashboard-chess-copy-mismatch.md`) with a
fuller picture. Four different places in this feature each claim something
different about which pipelines it tracks:

1. **`content/projects/pipeline-dashboard.mdx`** — copy says "Boston 311 and
   Chess tournament tracking," plus a "What's next" line promising a "Chess
   pipeline... pings the Lichess API hourly."
2. **`src/lib/PipelineStatusService.ts`**'s own header comment — says
   "pipeline_runs rows drive the 311 and chess cards" (line 3), but the SQL
   two lines below queries `WHERE pipeline IN ('311', 'ember')`. No chess —
   the comment doesn't match its own file's code.
3. **`getPipelineStatuses`'s actual return shape** (DB connected) —
   `['311', 'vendor-feed', 'ember']`.
4. **`src/app/api/pipeline-status/route.ts`'s no-DB fallback** (lines
   33–36) — emits only `['311', 'vendor-feed']`. No `ember`, no `chess` — a
   third, distinct shape.

`PipelineId` in `types.ts` is `'311' | 'vendor-feed' | 'ember'` — chess was
never a member, so `PipelineCard.tsx`'s `chess` entries in its
`DATA_SOURCE`/`DISPLAY_NAMES` label maps are unreachable dead code.

Confirmed on a clean `pnpm build && pnpm start`: the rendered page shows
"BOSTON 311" and "VENDOR FEED" cards directly under a paragraph promising
311-and-chess tracking.

This is a page explicitly about pipeline health and correctness, whose own
internal accounting doesn't agree with itself in three files, on top of the
public copy not agreeing with any of them.

## Root Cause

The tracked pipeline set changed over time (chess → vendor-feed/ember) and
the change wasn't propagated to the MDX copy, a stale code comment, or the
no-DB fallback branch.

## Fix

- Rewrite the intro paragraph and "What's next" section of
  `pipeline-dashboard.mdx` to describe the pipelines actually tracked (311,
  Vendor Feed, EmberBrief), dropping the Lichess/chess framing.
- Fix the stale "and chess" comment in `PipelineStatusService.ts`.
- Reconcile the no-DB fallback in `route.ts` to include `ember` (matching
  the real 3-pipeline shape), or document why it deliberately omits it.
- Remove the dead `chess` entries from `PipelineCard.tsx`'s label maps.

## Acceptance Criteria

- [ ] `pipeline-dashboard.mdx` copy matches the pipelines actually queried
      (311, Vendor Feed, EmberBrief) with no chess/Lichess references
- [ ] `PipelineStatusService.ts`'s header comment matches its own SQL
- [ ] The no-DB fallback in `route.ts` returns the same 3-pipeline shape as
      the DB-connected path (or the discrepancy is documented inline)
- [ ] `PipelineCard.tsx`'s dead `chess` label-map entries are removed

## Files to Touch

- `content/projects/pipeline-dashboard.mdx`
- `src/lib/PipelineStatusService.ts`
- `src/app/api/pipeline-status/route.ts`
- `src/components/projects/pipeline-dashboard/PipelineCard.tsx`

## Blocked by

None — can start immediately.

## Notes

Found in the 2026-08-23 QA pass (`docs/qa/2026-08-23-hiring-manager-qa.md`,
finding 15). Recommend filing this instead of draft 10 — same underlying
issue, more complete diagnosis and fix list.

**Update (2026-08-30 re-check): still reproduces.** All four sources of truth are unchanged — `pipeline-dashboard.mdx`'s chess copy, `PipelineStatusService.ts`'s stale comment, the real `['311', 'vendor-feed', 'ember']` query, and the no-DB fallback's `['311', 'vendor-feed']`. No code has changed since this was first documented.

**Update (2026-09-06 re-check): still reproduces.** Confirmed via grep
against today's `main`: `PipelineCard.tsx` and its test file still carry
`chess` references, and the MDX copy is unchanged. No code has moved since
first documented.
