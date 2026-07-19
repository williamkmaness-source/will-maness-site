---
title: "Remove unused create-next-app placeholder assets from public/"
labels: chore, low-priority
---

## Problem

`public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, and `window.svg`
are the default `create-next-app` scaffold icons. None are referenced
anywhere in `src/` or `content/`. Harmless functionally, but the repo is
explicitly part of the credibility pitch (`README.md`, `docs/MEMORY.md`: "Repo:
Public GitHub — codebase is part of the credibility pitch"), and a technical
reviewer browsing the repo — not just the live site — will see boilerplate
that was never cleaned up.

**Update (2026-07-18 re-check):** all five files still present in `public/`,
still unreferenced.

## Suggested fix

```
rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```

Confirm nothing references them first (`grep -rn "file.svg\|globe.svg\|next.svg\|vercel.svg\|window.svg" src content`).
