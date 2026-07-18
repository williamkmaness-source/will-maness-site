# Phase 1 Quiz — MVP scaffold

Answer these before moving to Phase 2. They cover the decisions made shipping the
MVP: the content collections, the dynamic project/writing routes, OG image
generation, the sitemap/robots surface, and the performance choices. Not gotchas —
a check on whether the foundation the rest of the site sits on makes sense to you.

---

**Q1.** Both the homepage's "Selected work" strip and the `/work` index render `WorkCard`s, but they don't show the same projects. Which `content.ts` helper does each use, and what single frontmatter field decides whether a project appears on the homepage?

*Your answer:*

---

**Q2.** `/work/[slug]/page.tsx` exports `generateStaticParams`. What does it return, where does it get the data, and what would happen to a brand-new project MDX file at build time if this function didn't exist?

*Your answer:*

---

**Q3.** `getProject(slug)` can return `undefined`. The project page calls `if (!project) notFound();`. What does `notFound()` actually do — what HTTP status does the visitor get, and which file now renders in that case?

*Your answer:*

---

**Q4.** There are three `opengraph-image` files: one at the app root, one under `work/[slug]`, and one under `writing/[slug]`. Why does a per-`[slug]` OG image need to live inside the dynamic route segment rather than being generated once? What determines the image's text?

*Your answer:*

---

**Q5.** `sitemap.ts` is not a static list — it imports `getAllProjects()` and `getAllPosts()`. Walk through what happens to the sitemap when a new writing post is added and pushed, with no other change. Which routes are hand-maintained in that file, and which are derived?

*Your answer:*

---

**Q6.** `robots.ts` allows all crawlers and points to the sitemap. Given that, how does a single page opt *out* of indexing without touching `robots.ts` at all? (Hint: it's a per-route metadata field — think about how `/ember` was handled.)

*Your answer:*

---

**Q7.** The homepage, `/work`, `/writing`, and `/about` are all server components — none ship an interactive `"use client"` island for their main content. Why does that matter for the Lighthouse 95+ requirement, and what specifically would regress if the homepage were made a client component "just to be safe"?

*Your answer:*

---

**Q8.** `getAdjacentProjects(slug)` / `getAdjacentPosts(slug)` power the prev/next links at the bottom of a detail page. What ordering do they rely on to decide what "next" means, and where does that ordering actually get established — in the adjacency helper, or upstream?

*Your answer:*

---

*Answers and discussion in the next session.*
