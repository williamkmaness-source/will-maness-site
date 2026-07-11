---
title: "MEMORY.md is stale and Phase 1 quiz is missing"
labels: docs, chore, low-priority
---

## Problem

`docs/MEMORY.md`'s status table still reads:

```
| 1 | MVP launch — all pages, 5 content pieces, OG images, Lighthouse pass | 🟡 Ready to start |
```

as of its last update (2026-05-06), while `docs/build-log.md` and the
live routes show Phase 1 shipped long ago, plus several post-MVP projects
(Chess Tournament Tracker, EmberBrief, Seasonal Color Palette, Vendor
intelligence feed, Pipeline Dashboard) are already live.

Separately, `_spec/execution-brief.md`'s teaching-overlay requirements call
for a `docs/quizzes/phase-N.md` at the end of each phase. `docs/quizzes/`
has `phase-0.md` and `phase-2.md`, but no `phase-1.md`.

Neither affects the live site, but both docs are part of the "teaching
overlay" process this repo is explicitly built to demonstrate (per
`CLAUDE.md`/`AGENTS.md` workflow steps and the execution brief's "Audience for
this brief" section), and it's the kind of gap a technical reviewer poking at
a public repo notices.

## Suggested fix

- Update `MEMORY.md`'s phase status table to reflect current reality.
- Either write the missing `docs/quizzes/phase-1.md`, or add a line in
  `MEMORY.md` noting why it was skipped, so the record is accurate either way.
