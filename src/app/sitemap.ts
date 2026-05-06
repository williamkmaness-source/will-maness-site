// app/sitemap.ts — XML sitemap for search engine crawlers.
// Auto-includes all projects and writing posts from the content collections.
// Add new static routes (e.g., /now, /talks) to the staticRoutes array.

import { getAllProjects, getAllPosts } from "@/lib/content";
import type { MetadataRoute } from "next";

const SITE_URL = "https://willmaness.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["/", "/work", "/writing", "/about"].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : 0.8,
  }));

  const projectRoutes = getAllProjects().map((project) => ({
    url: `${SITE_URL}/work/${project.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const writingRoutes = getAllPosts().map((post) => ({
    url: `${SITE_URL}/writing/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "never" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...projectRoutes, ...writingRoutes];
}
