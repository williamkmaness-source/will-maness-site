---
title: "fix(og): homepage share image fails to render (missing display:flex)"
labels: bug, seo, high-priority
---

## Problem

`src/app/opengraph-image.tsx`'s title `<div>` (lines 38–52) wraps two children
— a bare text node and a `<span>` — but has no `display` set at all:

```tsx
<div
  style={{
    fontSize: 52,
    fontWeight: 500,
    color: "#1F1E1A",
    lineHeight: 1.15,
    letterSpacing: "-0.015em",
    marginBottom: 24,
    maxWidth: 900,
  }}
>
  Product strategy and engineering
  <span style={{ color: "#2D4A3E" }}> in the AI-and-data stack.</span>
</div>
```

Satori (the renderer behind `next/og`'s `ImageResponse`) requires an explicit
`display: flex` on any div with more than one child — it has no implicit
block layout the way a browser does. The file's own header comment states
this rule, but this one div doesn't follow it.

Confirmed on a clean production build:

```
$ pnpm build && pnpm start
$ curl -o /dev/null -w '%{http_code}\n' http://localhost:3000/opengraph-image
```

The response fails — the server logs a Satori error about the missing
`display: flex`. This is the root `/opengraph-image`, and the homepage's
`og:image`/`twitter:image` meta tags point at exactly this URL. `/work/[slug]`
and `/writing/[slug]` OG images are unaffected — confirmed 200 + valid PNG.

The root domain — the URL most likely to appear on a resume, in an email
signature, or shared directly — currently shows no preview image on Twitter,
LinkedIn, Slack, or iMessage.

## Suggested fix

Add `display: "flex"` to the title `<div>`'s style object.

## Acceptance Criteria

- [ ] `GET /opengraph-image` returns `200` with a valid PNG on a production
      build (`pnpm build && pnpm start`)
- [ ] Visual spot-check: title renders with the accent-colored second
      sentence styled correctly (no regression from the fix)

## Files to Touch

- `src/app/opengraph-image.tsx` — add `display: "flex"` to the title div's
  style object

## Blocked by

None — can start immediately.

## Notes

Found in the 2026-08-23 QA pass (`docs/qa/2026-08-23-hiring-manager-qa.md`,
finding 11).

**Update (2026-08-30 re-check): still reproduces, byte-for-byte.** `main` hasn't moved since 2026-08-01 (`dd40435`) — this PR (#248) has been open a full week with failing Vercel CI and no review. Re-ran `pnpm build && pnpm start` and hit `/opengraph-image` directly: identical `Error: failed to pipe response` / `Expected <div> to have explicit "display: flex"...` in the server log. The root URL's share preview has now been broken across two consecutive weekly QA passes. This is a one-line fix (`display: "flex"` on the title div) sitting idle — recommend prioritizing this one.
