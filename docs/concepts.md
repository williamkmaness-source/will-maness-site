# Concepts

Framework-level explanations of patterns you'll encounter in this codebase. Written for someone comfortable in a terminal but new to Next.js and its ecosystem. Each entry is cross-referenced from the relevant source file's header comment.

---

## App Router

Next.js has two routing systems. This project uses the **App Router** (introduced in Next.js 13, the default since 14). The other system (Pages Router) still exists for legacy projects — ignore it.

In the App Router, your folder structure inside `src/app/` directly defines your URL routes. A file at `src/app/work/page.tsx` creates the `/work` route. A file at `src/app/work/[slug]/page.tsx` creates `/work/anything` (the `[slug]` brackets mean "dynamic segment — match whatever URL is here"). The `layout.tsx` files wrap their children, so `src/app/layout.tsx` wraps every page on the site. This is where global nav, footer, and fonts live.

---

## Server Components vs. Client Components

By default, every component in the App Router is a **Server Component**. It runs once on the server at request time (or at build time for static pages), generates HTML, and sends it to the browser. The browser receives fully rendered HTML — no JavaScript needed to see the content. This is great for performance and SEO.

A **Client Component** runs in the browser and can use browser APIs, React hooks like `useState`, and `useEffect`. To make a component a client component, add `"use client"` as the first line of the file. In this codebase, `Nav.tsx` is a client component because it uses `usePathname()` to highlight the active nav link. Everything else is a server component.

The rule of thumb: default to server components. Only add `"use client"` when you actually need interactivity or browser-only APIs.

---

## next/font

`next/font` is a Next.js built-in that downloads Google Fonts at build time and self-hosts them with your app. Zero requests to Google's servers at runtime — better privacy, better performance, no CORS issues, no layout shift.

In `src/app/layout.tsx`, `Newsreader` is imported from `next/font/google`. The `variable: "--font-newsreader"` option injects a CSS custom property that `globals.css` picks up in the `@theme` block. This is how `className="font-serif"` ends up using Newsreader rather than a system font.

---

## Tailwind v4 and the `@theme` block

Tailwind v4 (used in this project) moved from a JavaScript config file (`tailwind.config.ts`) to a CSS-based configuration in `globals.css`. Custom colors, fonts, and spacing are defined inside an `@theme` block.

`@theme inline { --color-accent: #2D4A3E; }` makes `text-accent`, `bg-accent`, and `border-accent` work as Tailwind utilities anywhere in the project. The `inline` keyword also makes `var(--color-accent)` available in plain CSS.

Design token values live in two places by design: `src/lib/tokens.ts` for TypeScript code that needs the raw values (e.g., generating OG images in Phase 1), and `globals.css` for CSS/Tailwind use. The source of truth is `_spec/design-tokens.md`.

---

## MDX

MDX is Markdown with JSX. It lets you write content in plain text markdown and embed React components inline. This project uses MDX for all project pages and writing posts.

**Why not a CMS?** A CMS adds a dashboard, a database, and another service to maintain. MDX files live in the repo alongside the code — they're versioned, diffable, and deployable with a `git push`. To publish a new post, you create a file and push.

**How it works in Next.js:** The `@next/mdx` package (configured in `next.config.ts`) teaches Next.js to import `.mdx` files like TypeScript modules. `mdx-components.tsx` in the project root registers React components that are available inside every MDX file without an explicit import.

**Frontmatter:** The YAML block at the top of each MDX file (`---title: "..."\n---`) is the frontmatter. `gray-matter` parses it into a plain object. Zod schemas in `src/lib/content-schemas.ts` validate it at build time. A typo in frontmatter fails the build with a clear error.

---

## Content collection

`src/lib/content.ts` provides functions (`getAllProjects`, `getAllPosts`, `getFeaturedProjects`, etc.) that read the `content/` directory at build time. These are server-only functions — they use Node.js `fs` to read files, which only works on the server.

Pages call these functions to get their data. The homepage calls `getFeaturedProjects()` and `getRecentPosts()` to populate the Selected Work strip and Recent Writing pull. The `/work` index calls `getAllProjects()` to show everything.

This is the pattern that makes "publish a new post by creating one file and pushing" work — no list to hand-maintain.

---

## Content schemas (Zod)

Zod is a TypeScript validation library. In this project, it validates the frontmatter of every MDX file matches the expected shape before the build succeeds.

If you add a project MDX file but forget the required `status` field, the build fails immediately with something like: `ZodError: Required`. This is intentional — better to catch a mistake at build time than to ship a page that renders broken data.

To add a new optional field to projects, add `newField: z.string().optional()` to `projectSchema` in `src/lib/content-schemas.ts`. To add a required field, add it to the schema and then add it to every existing project MDX file.

---

## Custom MDX components

*(Documented when the first interactive project ships — Phase 2: Vienna trainer.)*

The pattern: build the component under `src/components/projects/[slug]/`, register it in `mdx-components.tsx`, and use it as `<ComponentName />` in the MDX file. The registration step is what makes it available without an import in the MDX content.
