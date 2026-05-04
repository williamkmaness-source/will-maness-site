# Will Maness — Personal Site

A from-scratch personal site built with Next.js 16, Tailwind CSS v4, and MDX. Fast, semantic, no CMS required.

**Live site:** [willmaness.com](https://willmaness.com) *(coming soon — Phase 1)*

---

## Tech stack

- **Framework:** Next.js 16 with App Router, TypeScript, React 19
- **Styling:** Tailwind CSS v4 (CSS-based config) + a design token system in `src/lib/tokens.ts`
- **Content:** MDX via `@next/mdx` — all posts and project writeups are markdown files in `content/`
- **Typography:** Newsreader via `next/font/google` (self-hosted, zero Google requests at runtime)
- **Animation:** Framer Motion, used sparingly
- **Hosting:** Vercel free tier, auto-deploys on push to `main`

## Getting started

```bash
# Requires Node.js v20+ and pnpm
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The component gallery is at [http://localhost:3000/dev/components](http://localhost:3000/dev/components) (dev only).

## Publishing content

See [`docs/setup.md`](docs/setup.md) for the full workflow. Short version:

- **New blog post:** create `content/writing/[slug].mdx` with frontmatter and content, push to `main`.
- **New project:** create `content/projects/[slug].mdx`, push to `main`.
- No list to update anywhere — the indexes discover content automatically.

## Project structure

```
src/
  app/           App Router pages and layouts
  components/    React components (layout/ and ui/ subdirs)
  lib/           Shared utilities: tokens.ts, content.ts, content-schemas.ts
content/
  projects/      One MDX file per project
  writing/       One MDX file per post
docs/
  setup.md       Developer and author workflow
  concepts.md    Framework concepts explained for a non-engineer
  build-log.md   Running record of what was built and why
  quizzes/       Phase completion quizzes
_spec/           Original design brief and mockups (reference only)
```

## Build phases

- **Phase 0 (complete):** Foundation — toolchain, tokens, layout primitives, MDX pipeline, docs
- **Phase 1:** Homepage, project pages, writing posts, about page — full MVP launch
- **Phase 2:** Vienna Opening trainer — interactive chess project embedded in a project page
- **Phase 3:** Boston civic data project — DuckDB, Anthropic API, real data and opinions

## License

Personal site. Code is open for reference; content is not licensed for reuse.
