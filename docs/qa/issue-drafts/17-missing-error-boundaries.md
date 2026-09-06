---
title: "feat: add a root error.tsx boundary"
labels: enhancement, low-priority
---

## Summary

There is no `error.tsx` or `global-error.tsx` anywhere under `src/app/`. The
manual try/catch fallbacks in `vendor_feed/page.tsx` and the live-data
client widgets are well done, but they're per-component discipline, not a
safety net — any other server component that throws (a bad MDX import, an
unexpected data shape from a route not yet hardened) falls through to
Next's bare default error screen with no site chrome — the same failure
mode findings 01/02 originally described for two specific routes.

## Motivation

A single root boundary protects every route that hasn't been individually
hardened yet, without requiring each new project page to reinvent the same
try/catch pattern.

## Proposed Solution

Add `src/app/error.tsx` (a client component, per Next's requirement for
error boundaries) reusing `Container`/`Nav`/`Footer` the same way
`not-found.tsx` already does, with a one-line message and a way back home.

## Acceptance Criteria

- [ ] `src/app/error.tsx` exists and renders inside the normal nav/footer
      frame
- [ ] A deliberately-thrown error in a test route confirms the boundary
      catches it instead of falling through to Next's default error screen

## Files to Touch

- `src/app/error.tsx` (new)

## Blocked by

None — can start immediately.

## Notes

Found in the 2026-08-23 QA pass (`docs/qa/2026-08-23-hiring-manager-qa.md`,
finding 17).

**Update (2026-08-30 re-check): still reproduces.** No `src/app/error.tsx` exists on today's `main`.

**Update (2026-09-06 re-check): still reproduces.** No `error.tsx` or
`global-error.tsx` under `src/app/` on today's `main`.
