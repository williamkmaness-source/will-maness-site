// content.ts — functions that read MDX files from the content/ directory at build time.
// Uses gray-matter to parse frontmatter, and zod schemas to validate it.
// All functions are async and run only on the server (no "use client" here).
// See docs/concepts.md#content-collection for how this replaces a CMS.

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { projectSchema, writingSchema, siteSchema, type ProjectFrontmatter, type WritingFrontmatter, type SiteFrontmatter } from "./content-schemas";

const contentRoot = path.join(process.cwd(), "content");

function readMdxFile(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return matter(raw);
}

// ── Projects ────────────────────────────────────────────────────────────────

export function getAllProjects(): (ProjectFrontmatter & { slug: string })[] {
  const dir = path.join(contentRoot, "projects");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((file) => {
      const slug = file.replace(/\.mdx?$/, "");
      const { data } = readMdxFile(path.join(dir, file));
      return { slug, ...projectSchema.parse(data) };
    })
    .sort((a, b) => b.year.localeCompare(a.year));
}

export function getFeaturedProjects() {
  return getAllProjects().filter((p) => p.featured === true);
}

export function getProject(slug: string): (ProjectFrontmatter & { slug: string }) | undefined {
  return getAllProjects().find((p) => p.slug === slug);
}

// ── Writing ─────────────────────────────────────────────────────────────────

export function getAllPosts(): (WritingFrontmatter & { slug: string })[] {
  const dir = path.join(contentRoot, "writing");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => (f.endsWith(".mdx") || f.endsWith(".md")) && f !== ".gitkeep")
    .map((file) => {
      const slug = file.replace(/\.mdx?$/, "");
      const { data } = readMdxFile(path.join(dir, file));
      return { slug, ...writingSchema.parse(data) };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getRecentPosts(count = 3) {
  return getAllPosts().slice(0, count);
}

// ── Site ────────────────────────────────────────────────────────────────────

export function getSiteContent(): SiteFrontmatter {
  const filePath = path.join(contentRoot, "site.mdx");
  const { data } = readMdxFile(filePath);
  return siteSchema.parse(data);
}

// Returns adjacent projects for prev/next navigation on project pages.
export function getAdjacentProjects(slug: string) {
  const all = getAllProjects();
  const idx = all.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}

// Returns adjacent posts for prev/next navigation on writing pages.
export function getAdjacentPosts(slug: string) {
  const all = getAllPosts();
  const idx = all.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}
