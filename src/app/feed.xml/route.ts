// app/feed.xml/route.ts — RSS 2.0 feed for /writing.
// Built at request time from the writing content collection.
// Will can subscribe readers to https://willmaness.com/feed.xml.

import { getAllPosts } from "@/lib/content";

const SITE_URL = "https://willmaness.com";

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = getAllPosts();

  const items = posts
    .map(
      (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE_URL}/writing/${post.slug}</link>
      <guid>${SITE_URL}/writing/${post.slug}</guid>
      <description>${escapeXml(post.dek)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    </item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Will Maness — Writing</title>
    <link>${SITE_URL}</link>
    <description>Essays on AI infrastructure, data tooling, and product strategy.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
