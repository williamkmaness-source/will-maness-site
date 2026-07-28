---
title: "Add a custom 404 page"
labels: enhancement, polish, low-priority
---

## Problem

Any unmatched route (e.g. a mistyped URL, or a stale inbound link) falls
through to Next.js's bare default 404 — no nav, no footer, no site chrome:

```
404 | This page could not be found.
```

`_spec/execution-brief.md` explicitly defers a "custom 404" to Phase 4 along
with search, newsletter signup, and a `/now` page, so this is in scope and
expected as-is. Filing separately because it's currently the one place on the
site that breaks visual continuity by design, and — unlike the rest of Phase
4's scope — it's a small, self-contained fix.

**Update (2026-07-18 re-check):** `src/app/not-found.tsx` still doesn't
exist; behavior unchanged.

## Suggested fix

Add `src/app/not-found.tsx` reusing the existing `Container`, and rendering
inside the normal `Nav`/`Footer` frame (already global via
`src/app/layout.tsx`), with a one-line message and a link back home.

## Repro

1. Visit any unmatched route, e.g. `/this-does-not-exist`
2. Observe the bare default 404 page (no nav, no footer)
