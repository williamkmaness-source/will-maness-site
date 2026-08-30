---
title: "`/work/vendor_feed` legacy route crashes with an unhandled 500"
labels: bug, high-priority
---

## Problem

`src/app/work/vendor_feed/page.tsx` is a standalone server component left
over from before the Vendor Intelligence Feed project was migrated to the
content-driven `/work/vendor-feed` (hyphen) page. It queries Postgres with no
try/catch and no `error.tsx` boundary in that route segment.

Confirmed on a clean production build:

```
$ pnpm build && pnpm start
$ curl -o /dev/null -w '%{http_code}\n' http://localhost:3000/work/vendor_feed
500
```

Server log:

```
⨯ Error: No Postgres connection string found
    at c (.next/server/chunks/ssr/[root-of-the-server]__15y1t1x._.js:1:158)
    at h (.next/server/chunks/ssr/[root-of-the-server]__19ljcn5._.js:64:2973)
```

Any transient DB issue in production (Neon cold start, pool exhaustion,
credential rotation) will crash this URL the same way. It currently renders
Next's bare default error page — no nav, no footer, no brand. The route isn't
linked anywhere on the site and isn't in the sitemap, but it is publicly
reachable and only carries `noindex`, not a redirect or removal.

**Update (2026-07-18 re-check):** still reproduces identically one week
later against a fresh `pnpm build && pnpm start` — unchanged.

**Update (2026-07-25 re-check):** still reproduces identically. A fix is
now ready in **PR #234** (green CI, unreviewed) — this draft can likely be
closed once that PR merges rather than filed as a separate tracked issue.

**Update (2026-08-23 re-check): fixed and merged (#234).** The route was
kept rather than deleted (the "stay temporarily" alternative from the
suggested fix below), guarded with a try/catch that renders a designed
fallback instead of a 500. Confirmed against today's `main` — no longer
needs to be filed as a real issue. Kept here for the record. Now that the
route is staying long-term, see draft 18
(`docs/qa/issue-drafts/18-vendor-feed-url-naming-collision.md`) for the
follow-on naming-collision issue this creates against `/work/vendor-feed`.

**Update (2026-08-30 re-check):** still fixed, confirmed via source
(`try`/`catch` present in `page.tsx`) against today's `main`. No regression.

## Suggested fix

Delete `src/app/work/vendor_feed/` entirely — it's fully superseded by the
MDX-driven `/work/vendor-feed`. If it needs to stay temporarily for some
reason, at minimum add an `error.tsx` boundary and a redirect to the
canonical URL.

## Repro

1. `pnpm build && pnpm start`
2. Visit `/work/vendor_feed`
3. Observe HTTP 500 / unstyled error page
