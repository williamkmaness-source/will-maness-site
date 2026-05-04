# Setup Guide

Everything you need to clone, run locally, and publish new content. No engineering help required after Phase 1.

---

## Prerequisites

- **Node.js** v20+ (installed via Homebrew: `brew install node`)
- **pnpm** v10+ (installed via: `npm install -g pnpm`)
- **Git** (comes with macOS Xcode tools)

## Local development

```bash
# Clone the repo
git clone https://github.com/wkmaness/will-maness-site.git
cd will-maness-site

# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000). The dev server hot-reloads on save.

The component gallery (useful for seeing all UI primitives) lives at [http://localhost:3000/_dev/components](http://localhost:3000/_dev/components) — it only works in development mode, not in production.

## Publishing new content

### New blog post

1. Create `content/writing/my-post-slug.mdx`
2. Add frontmatter at the top:

```mdx
---
title: "Your post title"
date: "2026-05-01"
dek: "A one-sentence description shown in the writing index and on the homepage."
readTime: "7 min read"
---

Your post content in markdown here.
```

3. Commit and push to `main`. Vercel auto-deploys in ~30 seconds.

The writing index (`/writing`) and the homepage Recent Writing strip discover the post automatically — no list to update.

### New project (writeup only)

1. Create `content/projects/my-project-slug.mdx`
2. Add frontmatter:

```mdx
---
title: "Project title"
eyebrow: "Category · Subcategory"
year: "2026"
status: "complete"        # or "in-progress" or "forthcoming"
tags: ["engineering"]
summary: "One sentence shown on the work index card."
featured: false           # set true to surface on the homepage Selected Work strip
---
```

3. Commit and push.

### New project with a custom interactive component

See `docs/concepts.md#custom-mdx-components` — this gets documented when the first such project ships (Phase 2: Vienna trainer).

## Frontmatter validation

All frontmatter is validated against Zod schemas at build time (`src/lib/content-schemas.ts`). If you add an unknown field or misspell a required one, the build fails with a clear error message. To add a new optional field, add it to the schema first.

## Build commands

```bash
pnpm dev        # local dev server with hot reload
pnpm build      # production build (runs at deploy time)
pnpm start      # serve the production build locally
pnpm lint       # ESLint check
```

## Environment variables

No environment variables are required for local development at Phase 0. If added in later phases (e.g. Vercel Analytics tokens), they go in `.env.local` (gitignored) and are documented here.

## Deploying

Pushes to `main` deploy automatically via Vercel. Branch pushes get a preview URL — useful for reviewing a draft before making it live.

The production URL is listed on the Vercel project dashboard.
