# project_website Memory

_Last updated: 2026-05-06_

## Current Status

| Phase | Description | Status |
| ----- | ----------- | ------ |
| 0 | Foundation — Next.js, Tailwind, tokens, primitives, Vercel deploy | ✅ Done |
| 1 | MVP launch — all pages, 5 content pieces, OG images, Lighthouse pass | 🟡 Ready to start |
| 2 | Vienna Opening trainer embed | ⬜ Not started (depends on project_vienna) |
| 3 | Boston civic-data project | ⬜ Not started (depends on project_311) |

**Phase 0 quiz: passed 2026-05-06. Phase 1 build strategy grill-me: passed 2026-05-06.**

## Key Decisions

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind v4 + MDX + Framer Motion + Vercel. Package manager: pnpm.
- **Typography:** Newsreader (serif, self-hosted via next/font/google) for headlines + body. System sans for UI.
- **Palette:** Warm cream (`#F7F3EC`) base. Deep moss (`#2D4A3E`) for links/primary. Clay (`#B85C38`) as sparingly-used signature accent.
- **Content authoring:** MDX files in `content/`. No CMS. Publish = create file + push = Vercel auto-deploy.
- **Repo:** Public GitHub (codebase is part of the credibility pitch).
- **No dark mode at MVP** — deliberate; would need a full design pass.
- **In-progress project narratives:** 311 and Vienna project pages will be written as "here's what I'm building and why" — honest in-progress framing, not placeholders. Status field in frontmatter handles this.

## MVP Content Pieces (Phase 1)

1. Project writeup — Boston 311 web app (in-progress narrative)
2. Project writeup — Vienna Opening trainer (in-progress narrative)
3. Blog essay — one strong standalone piece
4. Blog essay — the website build itself
5. About page copy

## Open Questions

- [x] `willmaness.com` registered and live as of 2026-05-06. DNS resolving, apex redirects to www, Vercel serving 200.
- [ ] Headshot / custom illustration slot on About page
