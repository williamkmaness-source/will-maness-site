// WorkCard.tsx — a project card in the homepage "Selected work" grid and /work index.
// Renders title, summary, year, and tags. "in-progress" status reduces opacity per mockup.
// All text comes from MDX frontmatter via content.ts — nothing hardcoded here.

import Link from "next/link";
import { Tag } from "./Tag";
import type { ProjectFrontmatter } from "@/lib/content-schemas";

interface WorkCardProps {
  slug: string;
  project: ProjectFrontmatter;
}

export function WorkCard({ slug, project }: WorkCardProps) {
  const isUpcoming = project.status === "forthcoming";

  return (
    <Link
      href={`/work/${slug}`}
      className="group no-underline"
      style={{ opacity: isUpcoming ? 0.65 : 1 }}
    >
      <h3 className="font-serif text-[26px] font-medium leading-[1.25] tracking-[-0.01em] text-ink mb-[12px] group-hover:text-accent transition-colors duration-[120ms]">
        {project.title}
      </h3>
      <p className="font-sans text-[15px] leading-[1.6] text-ink-soft mb-[16px]">
        {project.summary}
      </p>
      <div className="flex items-center gap-[12px] font-mono text-[12px] text-hint">
        <span>{project.year}</span>
        {project.tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
    </Link>
  );
}
