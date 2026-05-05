# project_website Memory

_Last updated: 2026-05-04_

## Current Status

| Phase | Description | Status |
| ----- | ----------- | ------ |
| 0 | Foundation — Next.js, Tailwind, tokens, primitives, Vercel deploy | ✅ Done |
| 1 | MVP launch — all pages, 5 content pieces, OG images, Lighthouse pass | ⬜ Not started |
| 2 | Vienna Opening trainer embed | ⬜ Not started (depends on project_vienna) |
| 3 | Boston civic-data project | ⬜ Not started (depends on project_311) |

**Note:** Phase 0 quiz not yet passed. Will may need a walkthrough before Phase 1 begins.

## Key Decisions

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind v4 + MDX + Framer Motion + Vercel. Package manager: pnpm.
- **Typography:** Newsreader (serif, self-hosted via next/font/google) for headlines + body. System sans for UI.
- **Palette:** Warm cream (`#F7F3EC`) base. Deep moss (`#2D4A3E`) for links/primary. Clay (`#B85C38`) as sparingly-used signature accent.
- **Content authoring:** MDX files in `content/`. No CMS. Publish = create file + push = Vercel auto-deploy.
- **Repo:** Public GitHub (codebase is part of the credibility pitch).
- **No dark mode at MVP** — deliberate; would need a full design pass.

## Open Questions

- [ ] Domain registered? (`willmaness.com` recommended)
- [ ] Phase 0 quiz complete
- [ ] 5 MVP content pieces authored by Will
- [ ] Headshot / custom illustration slot on About page
