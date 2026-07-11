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

## Suggested fix

Delete `src/app/work/vendor_feed/` entirely — it's fully superseded by the
MDX-driven `/work/vendor-feed`. If it needs to stay temporarily for some
reason, at minimum add an `error.tsx` boundary and a redirect to the
canonical URL.

## Repro

1. `pnpm build && pnpm start`
2. Visit `/work/vendor_feed`
3. Observe HTTP 500 / unstyled error page
