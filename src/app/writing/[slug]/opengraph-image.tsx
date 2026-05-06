// app/writing/[slug]/opengraph-image.tsx — per-post OG image.
// Title and dek pulled from post frontmatter at build time.
// Satori requires explicit display:flex on every container with multiple children.

import { ImageResponse } from "next/og";
import { getAllPosts } from "@/lib/content";
import matter from "gray-matter";
import fs from "fs";
import path from "path";

// No edge runtime — generateStaticParams and Node.js fs APIs require default (Node) runtime.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

function getPost(slug: string) {
  const filePath = path.join(process.cwd(), "content", "writing", `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return undefined;
  const { data } = matter(fs.readFileSync(filePath, "utf-8"));
  return data as { title: string; dek: string };
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);

  return new ImageResponse(
    (
      <div
        style={{
          background: "#F7F3EC",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: "#6B665B",
            letterSpacing: "0.08em",
            fontFamily: "monospace",
          }}
        >
          Essay · Will Maness
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 50,
              fontWeight: 500,
              color: "#1F1E1A",
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
              marginBottom: 24,
              maxWidth: 900,
            }}
          >
            {post?.title ?? slug}
          </div>
          <div
            style={{
              fontSize: 20,
              color: "#6B665B",
              fontStyle: "italic",
              lineHeight: 1.5,
              maxWidth: 820,
            }}
          >
            {post?.dek}
          </div>
        </div>

        <div style={{ fontSize: 16, color: "#6B665B", fontFamily: "monospace" }}>
          willmaness.com/writing
        </div>
      </div>
    ),
    size
  );
}
