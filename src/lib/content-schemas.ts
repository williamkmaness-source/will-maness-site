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
