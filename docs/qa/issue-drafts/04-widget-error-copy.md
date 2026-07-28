---
title: "Live-data project widgets show a raw error string instead of designed fallback copy"
labels: bug, polish
---

## Problem

`StaffingDashboard` (Boston civic data) and `EmberDashboard` (EmberBrief) both
render the raw `Error(...)` message from their fetch call when the backing
API route fails — literally:

> API error 503

Reproduced locally (no DB configured, so `/api/311-departments` and
`/api/ember-data` return 503) — screenshots show this text rendering directly
below each project's pitch paragraph, styled (font-mono, centered) but still
developer-facing copy shown to a site visitor.

**Update (2026-07-18 re-check):** the same `throw new Error(\`API error
${res.status}\`)` → raw-message-in-render pattern also exists in a third
component, `RequestTypeBreakdown.tsx` (also Boston civic data — the
department-drilldown chart), which wasn't caught in the original pass. Same
fix applies to all three. Separately, the open `#210 fix(ember): restore
expired synoptic weather api key` issue is live corroboration that this isn't
hypothetical — the Ember weather fetch is presently failing in production,
so this exact raw-string render path is (or was, until #210 is fixed)
showing to real visitors right now, not just in a DB-less sandbox.

For contrast: the newly-shipped `PaletteSkeleton.tsx` (Seasonal Color
Palette widget) handles its own bad-input case the right way — a plain-English
inline message ("Not a color I can read — try a hex like `#7fb0d0`"), never a
thrown error's raw text. Worth using as the reference implementation when
fixing the three components above.

In `EmberDashboard.tsx` specifically, there's already better copy available
for exactly this situation:

```tsx
if (error || !data) {
  return (
    <div className="py-[64px] text-center">
      <p className="font-mono text-[13px] text-clay tracking-[0.04em]">
        {error ?? "Could not load fire data. The pipeline may still be initializing."}
      </p>
    </div>
  );
}
```

but the `error` branch (the raw HTTP message, e.g. `` `API error ${res.status}` ``)
takes precedence over the friendlier fallback, so the friendlier copy never
actually shows once a fetch has failed with a message.

This matters because these are exactly the widgets most likely to be
mid-failure when a hiring manager happens to click through — they depend on
external pipelines (NASA FIRMS/NOAA, Boston's CKAN API) and a Neon Postgres
instance that can cold-start or rate-limit.

## Suggested fix

In `StaffingDashboard.tsx`, `EmberDashboard.tsx`, and
`RequestTypeBreakdown.tsx`, always render a fixed, user-facing sentence in the
error state (e.g. "Live data temporarily unavailable — check back shortly")
and keep the raw thrown message out of the render path — log it to the
console or an error-tracking call instead.

## Repro

1. Run without `DATABASE_URL`/relevant env vars set (or throttle/kill the DB)
2. `pnpm dev`, visit `/work/boston-civic-data` or `/work/ember`
3. Observe "API error 503" rendered in place of the dashboard (and, on
   `/work/boston-civic-data`, again in the department drilldown chart once a
   department is selected)
