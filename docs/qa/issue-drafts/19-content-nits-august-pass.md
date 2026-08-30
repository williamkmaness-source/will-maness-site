---
title: "chore: fix small content/copy nits from the August QA pass"
labels: chore, low-priority
---

## Summary

Four small, independent text/content fixes found during the 2026-08-23 QA
pass, bundled here since none is individually worth a separate ticket.

## Steps

- [ ] Fix typo "continously" → "continuously" —
      `content/writing/ai-makes-you-busier.mdx:31`
- [ ] Fix stale comment in `src/app/dev/components/page.tsx:4` — it claims
      "the underscore prefix on `_dev`" but the actual directory is `dev`,
      no underscore (the `NODE_ENV` guard in the same file works correctly;
      only the comment is wrong)
- [ ] Either wire `draft` into `writingSchema`
      (`src/lib/content-schemas.ts`) so it actually hides a post from
      lists/feed/sitemap, or remove the no-op `draft: false` field from
      `content/writing/ai-makes-you-busier.mdx` so it doesn't look
      load-bearing
- [ ] Source or soften the metric "manual analyst baseline is approximately
      47 minutes" in `content/projects/ember.mdx:57` — reads as a precise
      benchmark with no stated methodology

## Why this matters

Small, individually low-stakes, but they're the kind of detail a careful
reader (the site's target audience) notices cumulatively.

## Blocked by

None — can start immediately.

## Notes

Found in the 2026-08-23 QA pass (`docs/qa/2026-08-23-hiring-manager-qa.md`,
finding 19).

**Update (2026-08-30 re-check):** all four nits unchanged in source (typo, stale comment, no-op `draft` field, unsourced metric). None fixed yet; still low-priority bundle.
