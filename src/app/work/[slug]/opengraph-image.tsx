// app/work/[slug]/opengraph-image.tsx — per-project OG image.
// Title and eyebrow pulled from project frontmatter at build time.
// Satori requires explicit display:flex on every container with multiple children.

import { ImageResponse } from "next/og";
import { getProject, getAllProjects } from "@/lib/content";

export const alt = "Will Maness — project";
// No edge runtime — generateStaticParams and Node.js fs APIs require default (Node) runtime.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllProjects().map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const project = getProject(slug);

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
            color: "#B85C38",
            letterSpacing: "0.08em",
            fontFamily: "monospace",
          }}
        >
          {project?.eyebrow ?? "Work"}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 500,
              color: "#1F1E1A",
              lineHeight: 1.15,
              letterSpacing: "-0.015em",
              marginBottom: 24,
              maxWidth: 900,
            }}
          >
            {project?.title ?? slug}
          </div>
          <div style={{ fontSize: 20, color: "#6B665B", lineHeight: 1.5, maxWidth: 820 }}>
            {project?.summary}
          </div>
        </div>

        <div style={{ fontSize: 16, color: "#6B665B", fontFamily: "monospace" }}>
          willmaness.com/work
        </div>
      </div>
    ),
    size
  );
}
