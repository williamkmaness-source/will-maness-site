# Build Log

A running record of meaningful units of work. Each entry is two to four sentences, date-stamped.

---

## 2026-05-03 — Phase 0: Deploy

**GitHub and Vercel.** Created public repo at `github.com/williamkmaness-source/will-maness-site` and deployed to Vercel. Live at `https://website-nine-lemon-70.vercel.app`. Vercel CLI deployed successfully but the GitHub auto-deploy integration (push-to-deploy) needs the GitHub Login Connection configured in the Vercel dashboard — until then, redeploy manually with `vercel --prod` from the project directory.

---

## 2026-05-03 — Phase 0: Foundation

**Toolchain.** Installed Node.js v25.9.0 and pnpm v10.33.2 via Homebrew. Initialized a Next.js 16 project with TypeScript, App Router, Tailwind v4, and ESLint using `pnpm create next-app`. Moved planning spec documents to `_spec/` to keep them alongside the codebase without polluting the project root.

**Dependencies.** Added `framer-motion`, `@next/mdx`, `@mdx-js/loader`, `@mdx-js/react`, `gray-matter`, `zod`, and `@types/mdx`. These cover animation (used sparingly), MDX content processing, frontmatter parsing, and schema validation respectively.

**Design tokens.** Created `src/lib/tokens.ts` as the TypeScript source of truth for all colors, typography, spacing, radii, and motion values — transcribed exactly from `_spec/design-tokens.md`. Rewrote `src/app/globals.css` to use Tailwind v4's `@theme` block (CSS-based config, no `tailwind.config.ts`) and a `:root` block so both `className="text-accent"` and `var(--accent)` work throughout the codebase.

**Fonts.** Wired Newsreader via `next/font/google` in `src/app/layout.tsx`. The font is downloaded at build time and self-hosted — zero Google requests at runtime. Weight 400 and 500, both normal and italic styles. Exposed as `--font-newsreader` CSS variable consumed by the `@theme` `--font-serif` definition.

**Layout primitives.** Built `Container`, `Stack`, `Prose`, `SectionLabel`, `Eyebrow`, `MetaStrip`, `Tag`, and `ClayDot`. Each has a header comment explaining its purpose. All visual values (sizes, colors, spacing) reference Tailwind utility classes backed by the token system — no raw hex or magic numbers.

**Nav and Footer.** Built to match the mockups exactly. `Nav` is the only client component in Phase 0 (needs `usePathname` for active link state). `Footer` is a server component. Both use `Container` for consistent horizontal layout.

**MDX pipeline.** Configured `next.config.ts` with `@next/mdx` and `pageExtensions`. Created `mdx-components.tsx` at the project root (required by App Router for MDX to work). Created `src/lib/content-schemas.ts` (Zod schemas for project and writing frontmatter) and `src/lib/content.ts` (server-side functions that read and validate the `content/` directory).

**Content directories.** Created `content/projects/` with four placeholder MDX files (`local-ai-stack`, `this-site`, `project-stellar`, `boston-civic-data`) and `content/writing/` with a `.gitkeep`. All frontmatter validates against the Zod schemas.

**Dev component gallery.** Built `src/app/_dev/components/page.tsx` — a visual inventory of all UI primitives. Gated behind a `NODE_ENV === "development"` check; returns 404 in production.

**Docs.** Wrote `docs/setup.md` (clone → dev → publish workflow), `docs/concepts.md` (App Router, server vs client components, next/font, Tailwind v4, MDX, content collection, Zod), and this build log.
