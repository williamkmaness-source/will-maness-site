---
title: "Work index doesn't show in-progress status, as required by the execution brief"
labels: enhancement, content
---

## Problem

`_spec/execution-brief.md` (Phase 1 definition of done) requires:

> The `/work` index shows all projects ordered by `year` descending with
> status indicators (in progress / complete / forthcoming).

In the shipped `WorkCard.tsx`, the only behavior tied to `project.status` is:

```tsx
const isUpcoming = project.status === "forthcoming";
// ...
style={{ opacity: isUpcoming ? 0.65 : 1 }}
```

No project currently uses `status: "forthcoming"`, so this never fires in
practice. `status: "in-progress"` — used by 7 of 10 projects as of this
re-check (Boston civic data, EmberBrief, Pipeline Dashboard, Seasonal Color
Palette, This site, Vendor intelligence feed, Sable) — renders visually
identical to `"complete"`. There is no label, dot, or other indicator
anywhere on the card.

**Update (2026-07-18 re-check):** still unaddressed one week later, and the
gap got slightly worse in the meantime — Seasonal Color Palette shipped a
real, polished "Slice 3" widget in that window and is still marked
`in-progress` with zero visual signal of that on the card.

This compounds the widget-error-copy issue (see companion issue): a hiring
manager who clicks into an in-progress project and hits a live-data error has
no prior signal they were looking at work still in flight — it just reads as
broken.

## Suggested fix

Render the status as a small label or dot on `WorkCard` (and/or the homepage
`Selected work` cards), at minimum distinguishing `in-progress` from
`complete`. The design system already has `ClayDot` and `Tag` primitives
suited to this — `Tag` is already used for the topic pills on the same card.

## Files

- `src/components/ui/WorkCard.tsx`
- `_spec/execution-brief.md` (source of the requirement, for reference)
