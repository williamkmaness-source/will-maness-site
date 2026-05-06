// app/robots.ts — robots.txt. Allow all crawlers; point to the sitemap.

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://willmaness.com/sitemap.xml",
  };
}
