---
title: "`/ember` is an indexable duplicate of `/work/ember`"
labels: bug, seo, high-priority
---

## Problem

`src/app/ember/page.tsx` is a standalone page that duplicates the canonical,
MDX-driven `/work/ember` project page — same pattern as the
`/work/vendor_feed` legacy route (see companion issue). Confirmed both return
HTTP 200 on a production build.

Unlike `/work/vendor_feed`, `/ember` has **no `noindex` meta at all**, so
search engines can index two URLs with substantially overlapping content — a
duplicate-content signal against a site whose SEO surface (project pages)
matters for discoverability. It also shares the same unguarded Postgres fetch
as the `/work/vendor_feed` issue, so it's a second surface for the same
crash-on-DB-hiccup failure mode.

## Suggested fix

Delete `src/app/ember/page.tsx` and its route (superseded by
`/work/ember`), or if there's a reason to keep the URL alive, make it a
301 redirect to `/work/ember` rather than a duplicate render.

## Repro

1. `pnpm build && pnpm start`
2. `curl -s http://localhost:3000/ember | grep -o 'name="robots"[^>]*'` → no match (no noindex)
3. Compare to `/work/ember`, which renders the same project content
