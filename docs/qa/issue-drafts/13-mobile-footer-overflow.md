---
title: "fix(footer): stop horizontal overflow on mobile viewports"
labels: bug, mobile, medium-priority
---

## Problem

`src/components/layout/Footer.tsx`'s contact row (lines 13–46) lays out
"Will Maness · Boston" plus four links (email, GitHub, LinkedIn, Twitter) in
a single `flex justify-between items-center` row with no
`flex-wrap`/breakpoint handling.

Measured via a headless-browser crawl at 390px width: `document.scrollWidth`
is 452px — a consistent 62px overflow — on every HTML route (home, about,
all 10 project pages, writing index and posts, 404). Traced to the footer
specifically via `getBoundingClientRect()`; visually confirmed in
screenshots (the Twitter link clips off the right edge on a phone).

This is the single most reproducible defect on the site — present on every
page, not an edge case.

## Root Cause

No responsive handling on the footer's contact-link row; four links plus a
location label don't fit a 390px viewport at their current gap/size.

## Fix

Wrap the contact row at a mobile breakpoint — e.g. stack "Will Maness ·
Boston" above the link group at `< sm`, or let the link group wrap
(`flex-wrap`) with a reduced gap. Match whatever responsive pattern
`Nav.tsx` already uses for its own mobile handling, for consistency.

## Acceptance Criteria

- [ ] `document.scrollWidth === document.clientWidth` (no horizontal
      overflow) at 390px width on every route
- [ ] Footer remains legible and functional at 390px (all four links still
      reachable and tappable)
- [ ] No regression to the existing desktop (1440px) footer layout

## Files to Touch

- `src/components/layout/Footer.tsx`

## Blocked by

None — can start immediately.

## Notes

Found in the 2026-08-23 QA pass (`docs/qa/2026-08-23-hiring-manager-qa.md`,
finding 13).

**Update (2026-08-30 re-check): still reproduces.** `Footer.tsx`'s contact row still has no `flex-wrap` or mobile breakpoint handling on the `flex justify-between items-center` row. Confirmed in source against today's `main`; code is byte-identical to last week.
