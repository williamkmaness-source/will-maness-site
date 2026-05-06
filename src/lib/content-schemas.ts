// content-schemas.ts — Zod schemas for MDX frontmatter validation.
// Every MDX file in content/projects/ and content/writing/ must match its schema.
// The build fails loudly on a mismatch — this is intentional. Better to catch a typo
// at build time than ship a broken page. See docs/concepts.md#content-schemas.

import { z } from "zod";

export const projectSchema = z.object({
  title: z.string(),
  eyebrow: z.string(),
  year: z.string(),
  status: z.enum(["complete", "in-progress", "forthcoming"]),
  tags: z.array(z.string()),
  summary: z.string(),
  // featured: true surfaces the project in the homepage Selected Work strip.
  featured: z.boolean().optional(),
  ogImage: z.string().optional(),
});

export const writingSchema = z.object({
  title: z.string(),
  date: z.string(),
  dek: z.string(),
  readTime: z.string().optional(),
  ogImage: z.string().optional(),
});

export type ProjectFrontmatter = z.infer<typeof projectSchema>;
export type WritingFrontmatter = z.infer<typeof writingSchema>;

// ── Site (content/site.mdx) ─────────────────────────────────────────────────
// Global copy for the homepage and about page. All human-readable text that
// appears on more than one route lives here. Edit this file to update copy.

export const siteSchema = z.object({
  // Homepage hero — split so the <em> portion can be styled separately.
  heroHeadline: z.string(),
  heroHeadlineEm: z.string(),
  heroSub: z.string(),
  currentlyLine: z.string(), // the single-line "currently in X · doing Y" on the homepage

  // About page structured content.
  aboutIntro: z.string(),
  currentlyList: z.array(z.object({ label: z.string(), value: z.string() })),
  sayHiHeadline: z.string(),
  sayHiBody: z.string(),
  calUrl: z.string(),
});

export type SiteFrontmatter = z.infer<typeof siteSchema>;
