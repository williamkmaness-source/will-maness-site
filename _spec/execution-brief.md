# Execution Brief — Will Maness Personal Site

This is the working brief for the implementation phase. It assumes the planning, design, and visual spec are settled. Where this brief and the source documents disagree, the source documents win — but the build mode and hard requirements below are non-negotiable.

---

## Audience for this brief

Claude Code, executing the build. Will Maness, reviewing and learning. Will is a strategy/operating background who codes at archetype B level: comfortable in a terminal, writes scripts, has shipped a Django app years ago, but doesn't ship production. He explicitly asked for documentation and quizzing throughout the build. The codebase needs to be teachable, not clever.

---

## Source documents (read in order before starting)

1. `personal-site-plan.md` — creative brief, IA, tech stack rationale, phased plan
2. `design-tokens.md` — colors, typography, spacing, border radii (the canonical visual spec)
3. `site-mockup.html` — homepage visual spec (this is the source of truth, replicate exactly)
4. `site-project-page.html` — project page visual spec
5. `site-about-page.html` — about page visual spec

The HTML mockups are the canonical visual reference. Do not reinterpret. If a detail in a mockup conflicts with the tokens doc, the tokens doc wins — and flag the conflict for resolution.

---

## Build mode

This build runs as **Option A with a teaching overlay**: Claude Code generates the codebase, Will writes content and quizzes along the way. Speed of shipping matters less than legibility of the result. The goal is a codebase Will can maintain alone after handoff and a real understanding of every part of it.

### Operational requirements for the teaching overlay

These are not optional. They are the reason the build is structured this way.

1. **Header comments on every file.** Two to four lines explaining what the file does, why it exists, and any non-obvious choices. Imports do not count as documentation.
2. **A `docs/build-log.md` updated after every meaningful unit of work.** A meaningful unit is: a new component, a new route, a new pattern, a non-trivial config change. Each entry is two to four sentences. Date-stamped. Surface each new entry to Will when written.
3. **A `docs/setup.md` maintained from day one.** Will should be able to clone the repo, follow the README, and have a working dev server. Updates as the project grows.
4. **A `docs/concepts.md` for framework-level explanations.** When introducing a concept Will may not know — App Router conventions, server vs client components, hydration boundaries, MDX compilation, next/font, etc. — write a four-to-six sentence explanation in this doc and link to it from the relevant code's header comment.
5. **Phase quizzes in `docs/quizzes/phase-N.md`.** Five to seven questions at the end of each phase. Mix of recall ("what does the App Router do with a `page.tsx` file?") and applied ("if I want to add a new project, what files do I create or change?"). Will answers them; questions he gets wrong reveal what to revisit before the next phase.
6. **Default to mainstream patterns.** When there's a choice between novel and conventional, pick conventional even if novel is technically nicer. Will should be able to search any pattern in this codebase on Stack Overflow or in framework docs.

---

## Stack (committed, do not relitigate)

- Framework: Next.js 15+ with App Router, TypeScript, React 19+
- Styling: Tailwind CSS (v4 if stable on Next 15, otherwise v3) + a `lib/tokens.ts` design-system module
- Content: MDX via `@next/mdx`. All human-written copy lives in MDX or a typed content directory under `content/`.
- Typography: `Newsreader` self-hosted via `next/font/google`; system fallback chain per `design-tokens.md`
- Animation: Framer Motion, used sparingly. Not imported on routes that don't use it.
- Hosting: Vercel free tier
- Repo: GitHub, public
- Analytics: Vercel Analytics (free tier)
- No CMS, no database, no auth, no client-side state library

Package manager: pnpm.

---

## Hard requirements

These hold across the entire build. Treat any violation as a bug.

1. **No hardcoded human copy in components.** Every piece of text Will would conceivably edit lives in MDX or a typed content file under `content/`. This includes the hero copy on the homepage, the section labels, the "currently" list, the contact CTA copy, the footer location text, the meta description, the page titles, all of it. Components import; they do not embed. The only allowed string literals in components are technical/structural items — aria-labels, form errors, loading states. Will is going to write all the real copy himself once the site is up; the build must make that one-file edit, not a code archaeology project.
2. **Tokens are the single source of truth for visual.** Colors, type sizes, spacing, and radii live in `lib/tokens.ts` and Tailwind config. No raw hex anywhere except tokens.ts. No magic numbers in component sizing.
3. **Performance budget.** Lighthouse 95+ on home, project page, and about page at MVP launch. Default to server components. Use Framer Motion only where it's earning its keep.
4. **Accessibility.** WCAG AA contrast minimum, working keyboard navigation, semantic HTML, alt text required on `Image` (lint-enforced).
5. **Public repo with a useful README.** Will is going to write a project page about building this site. The repo and README are part of the deliverable. Write them as such.

---

## Build sequence

### Phase 0 — Foundation

Before any real content renders:

1. Initialize Next.js 15 with TypeScript, App Router, Tailwind, ESLint, `src/` directory layout
2. Install `framer-motion`, `@next/mdx`, `next/font`, `gray-matter`, `zod`, and required MDX deps
3. Create `lib/tokens.ts` reflecting `design-tokens.md` exactly. Wire colors into `tailwind.config.ts` as named utilities. Wire fonts via `next/font/google` in `app/layout.tsx`.
4. Build the layout primitives: `Container`, `Stack`, `Prose`, `SectionLabel`, `Eyebrow`, `MetaStrip`, `Tag`, `ClayDot`. Each with a header comment and a Storybook-style demo route at `/_dev/components` that's gated to development builds only.
5. Build `Nav` and `Footer` components. Replicate the mockups exactly.
6. Set up `app/layout.tsx` with the global frame: nav, footer, font loading, base styles.
7. Set up MDX processing: frontmatter parsing via `gray-matter`, typed content schemas via `zod`, automatic content collection at build time.
8. Create the content directories. `content/site.mdx` for global copy (hero, footer text, "currently" list, contact CTA). `content/projects/*.mdx` for projects. `content/writing/*.mdx` for posts.
9. Deploy to Vercel from day one. Site says "coming soon" but is live at the eventual production domain (or a vercel.app URL until the domain is registered).
10. Write `docs/setup.md`, `docs/concepts.md` (initial pass with App Router, MDX, next/font, Tailwind tokens, server vs client components).
11. Phase 0 quiz.

**Definition of done:** Will can clone the repo, run `pnpm dev`, see a styled placeholder page that uses the tokens, and explain the folder structure unprompted.

### Phase 1 — MVP launch

Once Phase 0 is solid:

1. Homepage. Replicate `site-mockup.html` exactly. All copy pulled from `content/site.mdx` and the projects/writing collections.
2. Project page template. Replicate `site-project-page.html`. Build the `StackList` component (the tools-with-status-dots block — it's a recurring custom component). Style code blocks with the colors in `design-tokens.md`. Build the pullquote, the meta-strip, the eyebrow, and the next/prev navigation. Ship using the Boston 311 project as the first canonical content (see step 10 — this is one of the five MVP pieces, written as an in-progress narrative).
3. Writing post template. Reuse the project-page typography. Drop the eyebrow and the "self-initiated" pill. Same next/prev pattern.
4. Work index. Richer version of the homepage's "Selected work" block. Same card pattern, all projects shown.
5. Writing index. List of essay teasers, same visual pattern as the homepage's "Recent writing" pull.
6. About page. Replicate `site-about-page.html`. Drive the "currently" list from `content/site.mdx`. Use the topographic-mark SVG as a temporary placeholder; Will will replace it with a stylized headshot later — the slot stays.
7. Programmatic OG image generation via `@vercel/og`. Every project, post, and primary route gets a generated share image.
8. RSS feed for `/writing`. Sitemap. `robots.txt`.
9. Wire `mailto:` and the Cal.com link for the contact actions on the about page.
10. Will writes the five MVP content pieces; Claude Code provides a copy-edit pass and visual polish. The five pieces are:
    - `content/projects/boston-311.mdx` — Boston 311 civic data web app (in-progress narrative; use `status: in progress` in frontmatter)
    - `content/projects/vienna-trainer.mdx` — Vienna Opening trainer (in-progress narrative; use `status: in progress` in frontmatter)
    - `content/writing/[slug].mdx` — one strong standalone essay
    - `content/writing/building-this-site.mdx` — the website build itself as a writing piece
    - About page copy in `content/site.mdx`
    
    Both project writeups are intentionally published before the apps ship. Frame them as "here's what I'm building and why" — honest in-progress work is more compelling to a hiring manager than a placeholder. The `status` field in frontmatter surfaces the correct indicator on the work index automatically.
11. Final pass: accessibility audit, Lighthouse pass, manual QA on mobile.
12. Phase 1 quiz.

**Definition of done:** site is live at the production domain, all five MVP pieces published, Lighthouse 95+ on home / project / about, Will can publish a new blog post by editing one MDX file and pushing.

### Phase 2 — Vienna Opening trainer

A focused interactive engineering project, slotted as the first follow-on after MVP launch. The site stays live throughout; this ships as a new project added to the work index after launch.

**Scope.** A browser-based trainer that walks a visitor through the first ten moves of the Vienna Opening as White. Black plays a weighted-random response from a precomputed theory tree, so each session feels different. White plays against the trainer's "top theory line" check — if the visitor plays a move other than the recognized canonical move, the trainer says "not the mainline, try again" and rewinds one ply. After two wrong attempts on the same position, a "show me" affordance becomes available.

**Tech approach.**

- Game logic: `chess.js` for legal-move generation, FEN/PGN handling, SAN parsing
- Board UI: `react-chessboard` for drag-and-drop. Pairs naturally with `chess.js`. Mainstream and well-documented; pick this over `chessground` for legibility unless feel becomes a real issue.
- Theory tree: precomputed JSON at `content/projects/vienna-trainer/theory.json`. Each white-to-move node carries the canonical SAN for the next move; each black-to-move node carries a weighted array of plausible responses with probabilities. Tree is hand-curated for the first ten moves of Vienna mainlines — realistic universe is 2...Nf6, 2...Nc6, 2...Bc5, and their continuations through move 10. Build pipeline: pull initial weighted moves from the Lichess Masters opening explorer API at build time, trim to mainlines, commit the result as static JSON. The API call happens at build time, not runtime — the deployed site has zero external API dependencies.
- State: a small reducer that tracks the current node in the tree, the move history, and the wrong-attempt counter for "show me" gating. No external state library.

**UX.**

- Board centered, White at the bottom
- Right pane (below on mobile): move list in SAN; a small "currently in: [variation name]" indicator pulled from the theory tree; a status banner ("your move" / "not the mainline — try again" / "well played"); a reset button; a "show me" button gated by the wrong-attempt counter
- At move 10: "Well played. You've completed [variation name] through move 10. Reset to try a different line?"
- Mobile-responsive: board reflows, controls stack below

**Embedding.**

- Lives at `/work/vienna-trainer`
- The project page is an MDX file with the writeup; the trainer is a client React component imported into the MDX (`<ViennaTrainer />`). MDX drives the page; the component is one block within the article.
- Optional fullscreen mode: a button on the trainer expands to a full-page view that hides article chrome. URL stays the same — fullscreen is UI state, not a route.

**Definition of done.**

- Trainer renders, plays correctly move-for-move, validates moves against the theory tree, randomizes Black responses across sessions
- Reset and wrong-move rewind work
- Project page writeup ships alongside (motivation, theory tree structure, validation engine, what was hard, what's next)
- Mobile works
- Lighthouse 95+ on the project page including the trainer
- Phase 2 quiz

**Effort.** ~25–35 hours. The logic is small (a state machine plus a precomputed tree); most of the work is the theory tree, the writeup, and polish.

---

## Out of scope for MVP launch

These items are deliberately deferred to subsequent phases or deliberately not built at all. Do not build them as part of Phase 0 or Phase 1, even if they look quick.

- Vienna Opening trainer (Phase 2 — full scope defined above)
- Boston civic-data project (Phase 3 — separate scope, document TBD)
- CMS layer (deliberately not built)
- Newsletter signup (Phase 4 if at all)
- Search (Phase 4 if at all)
- Comments (deliberately not built)
- Dark mode toggle (deliberately not built; would require a real design pass)
- `/now` page, custom 404, talks page (Phase 4)
- Analytics beyond Vercel default
- Internationalization
- Image optimization beyond what `next/image` does by default

---

## Adding new content (post-launch operating manual)

Will should be able to publish without engineering help. The architecture supports this; the workflow is intentionally one or two file operations. Document this workflow in `docs/setup.md` so it's reachable from the repo.

**To add a new blog post.** Create `content/writing/[slug].mdx`. Add frontmatter (`title`, `date`, `dek`, optional `readTime`, optional `ogImage`). Write the post in MDX — markdown plus optional embedded React components. Commit and push. Vercel auto-deploys. The /writing index and the homepage's Recent Writing pull discover the new post automatically; no list to update.

**To add a new project (writeup-only).** Create `content/projects/[slug].mdx`. Add frontmatter (`title`, `eyebrow`, `year`, `status`, `tags`, `summary`, optional `ogImage`, optional `featured: true` to surface on the homepage Selected Work block). Write the writeup. Commit and push.

**To add a new project with a custom interactive component** (e.g., the Vienna trainer pattern). Create `content/projects/[slug].mdx` with frontmatter as above. Build the component(s) under `components/projects/[slug]/`. Register the component in the MDX scope. Commit and push. Document the registration pattern in `docs/concepts.md` when the first such project ships so subsequent ones are mechanical.

**Frontmatter schemas.** The exact frontmatter shapes are defined in `lib/content-schemas.ts` using zod and validated at build time. Adding a new optional field is a one-line schema addition; adding a new required field requires a backfill across existing content. Build will fail loudly on a frontmatter mismatch — this is intentional.

**What the home page and indexes show.** The homepage's Selected Work strip pulls projects with `featured: true`, ordered by `year` descending. The /work index shows all projects ordered by `year` descending with status indicators (in progress / complete / forthcoming). The Recent Writing block on the homepage shows the three most recent posts; /writing shows all. None of these is hand-maintained.

---

## Pre-build checklist

Before the first PR:

- Domain registered and pointed at Vercel. `willmaness.com` confirmed available as of 2026-05-06 — must be registered before Phase 1 ships. Vercel.app URLs are acceptable during the Phase 1 build but not at launch.
- GitHub repo created, public
- Vercel project connected to the repo
- Will has read all five source documents
- Will has approved Phase 0 scope
- An initial 30-minute kickoff to walk through the source documents and answer questions

---

## How to use this brief in Claude Code

The simplest path: open Claude Code in an empty repo, paste this brief into the first message along with the five source documents (or attach them), and start with "Begin Phase 0 from the execution brief."

Claude Code should pause at each step that introduces a new concept, surface the addition to `docs/build-log.md`, and check in with Will before moving to the next step. The teaching overlay is the build mode; treat it as load-bearing, not as commentary.
