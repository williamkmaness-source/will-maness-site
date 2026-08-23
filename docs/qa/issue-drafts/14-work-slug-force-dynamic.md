---
title: "perf(work): remove blanket force-dynamic from /work/[slug]"
labels: enhancement, performance, medium-priority
---

## Summary

`src/app/work/[slug]/page.tsx:14` sets `export const dynamic =
"force-dynamic"` for the entire route, even though the same file defines
`generateStaticParams` (line 20) — a static param list wired to a route
that's forced dynamic anyway. `pnpm build`'s route table confirms it:
`ƒ /work/[slug]` (server-rendered on demand) versus `● /writing/[slug]`
(prerendered as static HTML).

This directly contradicts `content/projects/this-site.mdx`'s own copy
("Lighthouse 95+ ... is the default behavior of the architecture," "the
static-by-default posture"). Only two projects
(`boston-civic-data`, `ember`) have live-data widgets, and those are client
components that fetch their own API routes independently of the page shell
— so the page shell itself doesn't need to be dynamic even for those two.

## Motivation

The page most likely to get a close technical read (a project writeup) is
currently making a specific, checkable claim about its own rendering
architecture that isn't quite how the route is actually configured. Fixing
it also gets faster TTFB/lower server load for the 8 of 10 projects that are
pure MDX content with no request-time dependency.

## Proposed Solution

Remove the blanket `force-dynamic` from `src/app/work/[slug]/page.tsx` and
let `generateStaticParams` do its job for the route shell. If any
project's page shell genuinely needs request-time rendering, opt that
specific project's data path into dynamic behavior individually rather than
blanketing the whole `[slug]` route.

## Acceptance Criteria

- [ ] `pnpm build`'s route table shows `/work/[slug]` as prerendered
      (`●`/`○`), not `ƒ` (dynamic), for projects with no request-time data
      dependency
- [ ] All 10 project pages still render correctly, including
      `boston-civic-data` and `ember` (their client widgets still fetch
      live data independently)
- [ ] No regression in `pnpm build`/`pnpm test`

## Files to Touch

- `src/app/work/[slug]/page.tsx` — remove or scope the `force-dynamic` export

## Blocked by

None — can start immediately.

## Notes

Found in the 2026-08-23 QA pass (`docs/qa/2026-08-23-hiring-manager-qa.md`,
finding 14).
