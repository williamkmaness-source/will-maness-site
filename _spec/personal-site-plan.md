# Personal Site Plan — Will Maness

A working plan based on our conversation. Treat this as a draft to react to, not a finished spec — the next pass should incorporate your reactions to the visual direction, the IA choices, and any tech preferences you have.

---

## 1. Creative Brief

**The job to be done.** When a VP of Product at an AI-infrastructure or data-tooling company — Starburst, Composio, Anthropic, Google, n8n, ClickHouse, Databricks, Suno, Fivetran — lands on this site after receiving your outreach email, the site should make them think: *this person is interesting, I'll take the call.* The site is a backstop for warm cold outreach, not a top-of-funnel lead generator. Success is being remembered and being judged worth thirty minutes.

**The strategic problem.** Your business and strategy credentials are well-established. The recurring concern from this audience is technical chops. The site exists to neutralize that concern — not by overclaiming engineer-level depth (which would backfire in interviews), but by demonstrating substantive, current, hands-on fluency with the tools and ideas this audience actually cares about. The site itself is part of that proof: a custom-built, well-typeset, fast-loading personal site is silent evidence before the visitor reads a single case study. A templated site would actively undercut the pitch.

**Positioning.** A senior business-and-strategy operator with substantive technical fluency, a strong opinion on the AI-and-data ecosystem, and the taste to ship work people want to read. Not a software engineer, not pretending to be, but visibly comfortable in the trenches.

**Tone and visual direction.** Anthropic-grade restraint as the structural base — serif-led, generous spacing, considered typography, restrained palette, no decorative noise, type doing most of the heavy lifting. Layered with selective personality moments in the spirit of Maggie Appleton and Josh Comeau: a custom illustration or two, a confident accent color, and one or two genuinely interactive flourishes used sparingly so the site reads as warm and human rather than corporate. Product-flavored, not bookish. Adjectives that should apply: considered, current, opinionated, warm, substantive. Adjectives that should not: minimal, generic, scrappy, decorative, agency-slick, parallax-y.

**Content.** Five MVP pieces, all of which you'll author: one or two market-perspective essays that restate the strategy credential; Project Stellar progress and mocks; a writeup of building this site itself (a self-vouching loop); a writeup of your local AI techstack setup; and trial-feedback notes on leading product capabilities. Two engineered projects ship in subsequent phases. First, an interactive Vienna Opening trainer — embedded in its project page, walking visitors through the first ten moves of the Vienna as White against a weighted-random Black response from theory, prompting retries on incorrect moves. Second, a Boston/Massachusetts municipal-data project that uses ecosystem-relevant tooling — DuckDB or ClickHouse for the data layer, an Anthropic-API-shaped layer for analysis, possibly an orchestrator like n8n or Dagster — and gives the writeup real opinions. Adding additional projects or blog posts beyond these is intentionally low-friction: a single new MDX file in the `content/` directory and a push to GitHub; the home page and index pages discover it automatically.

**Success criteria.** Three to five hiring-manager replies referencing something specific from the site within six months of launch. Longer-term: a durable home for work that stays current with a light quarterly content cadence rather than a yearly overhaul.

---

## 2. Information Architecture / Sitemap

Deliberately small. Four primary destinations, accessible from a quiet text-only nav.

```
/                        Home
/work                    Index of projects (cards with substantive previews)
/work/project-stellar    Project page
/work/local-ai-stack     Project page
/work/this-site          Meta writeup of building the site
/work/vienna-trainer     Interactive Vienna Opening trainer (writeup + embedded app)
/work/boston-civic-data  Civic-data technical centerpiece
/writing                 Index of essays
/writing/[slug]          Individual post
/about                   Bio + contact CTA at bottom
404                      Small custom 404 with personality
```

**Navigation.** A wordmark on the left, four items on the right: Work, Writing, About, and a quiet "say hi" link that opens email or scrolls to the about-page contact section. No /contact page — keep it simple.

**Footer.** Email, a scheduling link, GitHub, LinkedIn. Visible on every page, so a hiring manager who's convinced after twenty seconds can reach you without hunting.

**Home page above the fold.** A short identity statement (one or two sentences, no jargon, no "passionate about disrupting"), a featured-work strip with two or three cards, and one recent-writing pull. Not a giant hero video. Not a wall of project tiles. The page should answer in five seconds: *who is this, what do they do, what should I look at next.*

**Project page template.** A title, a one-line gloss, the year, your role, the tools used, a hero image or interactive embed, and then long-form prose with images. No PDF case studies. No Notion exports. Each project should be readable in five minutes and skimmable in thirty seconds.

---

## 3. Tech Stack

The biasing principle: boring, mainstream, well-documented choices the target audience will recognize and respect, with a codebase that's legible enough for me to teach you piece by piece.

**Framework.** Next.js (App Router) with React and TypeScript. It's what your audience uses, ships fast static pages out of the box, has the largest documentation surface on the open internet (which makes the quizzing loop work), and Vercel deploys it for free.

**Content authoring.** MDX. Each blog post and project page is a markdown file in the repo with the option to embed React components inline — exactly how you get Josh-Comeau-style interactive widgets without standing up a CMS. To publish, you edit a file, commit, push; Vercel auto-deploys. This is also how engineers ship, which is on-brand.

**Styling.** Tailwind CSS for utility scaffolding, plus a small custom design-system layer (a `tokens.ts` file for colors, typography, and spacing; a handful of atomic React components like `Stack`, `Prose`, `Card`). Tailwind is the audience-default, and the tokens layer keeps the codebase teachable.

**Typography.** A serif for headlines and body — strong free options are Newsreader or Source Serif; a paid alternative if budget allows is GT Super or Tiempos. A quiet sans for UI (Inter or similar). Self-hosted for performance.

**Animation and interaction.** Framer Motion. One library, well-documented, easy to teach. Used sparingly — page transitions and one or two signature widgets, not everywhere.

**Hosting.** Vercel free tier. Zero-config Next.js deploys, branch-preview URLs (great for "look at this draft before I push it live"), generous limits.

**Domain.** Pick something at Cloudflare Registrar or Namecheap, ~$12/year. Recommended candidates: `willmaness.com`, `wkmaness.com`, `maness.io`, `willmaness.dev`. The `.com` is preferable for credibility with a non-technical adjacent audience; `.dev` reads slightly more developer-coded but signals technical stance, which matches the brief.

**Analytics.** Vercel Analytics (free) at MVP. Optional upgrade to Plausible (~$9/month) later — it's privacy-friendly, lightweight, and a small signal of taste.

**SEO.** Next.js metadata API + a programmatic Open Graph image generator (so every post and project gets a custom share image automatically). Sitemap and RSS for `/writing`.

**Contact / scheduling.** Mailto link plus Cal.com (free tier) for booking. No backend needed.

**Version control.** GitHub. Public repo is recommended — the codebase becomes additional credibility. If you'd rather keep it private, that's fine, but consider that a hiring manager who reads the "this site" writeup may want to look.

**Total cost.** $0 baseline plus ~$12/year for the domain. Optionally ~$9/month for Plausible later. No CMS required, no database required, no server required.

**Why no CMS.** A CMS adds a dashboard, a database, and another vendor to maintain — none of which you need given a writing cadence of a few posts per quarter and a single author. Markdown-in-repo gives you version history, drafts, branching, and full embed power for free. To publish a new post or project, you edit or create one MDX file in `content/`, commit, and push — Vercel auto-deploys. The home page's Selected Work strip, the /work index, and /writing all pull from these directories automatically; there's no manual list to maintain. If you ever want phone-based editing later, Sanity or Notion-as-CMS can be bolted on without rewriting anything else.

---

## 4. Phased Build Plan

Effort estimates assume option A: I generate the code and walk you through it; you write content and answer quizzes. Numbers are rough — they describe order of magnitude, not commitments.

**Phase 0 — Foundation. ~12–15 hours of code work, calendar week 1–2.**
Pick and register the domain. Spin up the Next.js project. Set up Tailwind, the design tokens file, and the typography pipeline (fonts loading correctly, scale defined). Build the layout primitives: nav, footer, container widths, color system, prose styles for long-form text. Wire up Vercel deploys from day one with placeholder content so you can see the site live as it grows. By the end of phase 0, the site exists at a real URL but says almost nothing.

**Phase 1 — MVP launch. ~25–30 hours total, ~10–15 of which is your content writing, calendar weeks 3–5.**
Build the home page, the work index, one canonical project page template (Project Stellar is the easiest first target — you have material), the writing index, one canonical post template, and the about page. Ship one custom illustration or signature visual element so the site doesn't feel template-y. Ship one subtle interactive flourish — something like a hover-to-reveal annotation or an inline embedded chart — to set the tone. Draft and publish the five MVP content pieces. Wire up Open Graph image generation, RSS, sitemap, real meta tags. Site goes live with content. This is the version you can put in your outreach email signature.

**Phase 2 — Vienna Opening trainer. ~25–35 hours, post-MVP launch.**
A focused interactive engineering project. The site stays live throughout; this ships as the first project added after launch. The trainer walks visitors through the first ten moves of the Vienna Opening as White, with Black playing a weighted-random response from theory and the trainer asking the visitor to retry on incorrect moves. Tech: `chess.js` for game logic, `react-chessboard` for the UI, a precomputed JSON theory tree shipped as content. The trainer is embedded as a React component in an MDX project page, so the writeup contextualizes the work — motivation, theory tree structure, validation engine, what surprised me — with the live trainer as the centerpiece. This adds a concretely demonstrable interactive piece to the work index, which is the kind of thing that converts "this person is interesting" to "I'll take the call."

**Phase 3 — Boston civic-data project. ~25–35 hours.**
The technical centerpiece on a different axis: real data, real opinions, real long-form writeup. Use ecosystem-relevant tooling — DuckDB or ClickHouse, an Anthropic-API-shaped analysis layer, possibly n8n or Dagster for orchestration. Single highest-leverage piece of content for the technical-chops question because it gives the writeup real opinions on the AI-and-data ecosystem from inside a real workload. Pair with a meaningful performance and accessibility audit (95+ Lighthouse) and a small refinement pass on the illustration system based on what the site has taught us by then.

**Phase 4 — Stretch and ongoing.**
Optional additions, in rough order of value: a `/now` page (à la nownownow.com) showing what you're currently focused on; a small newsletter via Buttondown if writing cadence picks up; a custom 404; a "talks" or "press" section if/when those start happening; a CMS layer if you ever get tired of markdown. Set a quarterly cadence for content refreshes — one new project writeup or essay every two to three months keeps the site current without becoming a second job.

---

## Open questions for the next pass

1. **Visual direction confirmation.** Does "Anthropic structural base + selective Maggie/Josh personality moments" land? If yes, I'll start sketching specific moves (illustration approach, accent color, the one-or-two interactive flourishes) in the next round.
2. **Domain pick.** Of `willmaness.com`, `wkmaness.com`, `maness.io`, `willmaness.dev` — any preference, or want me to recommend?
3. **Repo public or private.** Lean public for the credibility gain, but your call.
4. **Boston/MA data project scope.** Tabled this earlier; ready to come back to it whenever. Once we lock the project shape, phase 2 effort numbers tighten up.
