// WorkCard.tsx — a project card in the homepage "Selected work" grid and /work index.
// Renders title, summary, year, a status indicator, and tags. "forthcoming" reduces
// opacity; "in-progress" shows an active dot + label (execution brief: the index shows
// status indicators). All text comes from MDX frontmatter via content.ts — nothing hardcoded.

import Link from "next/link";
import { Tag } from "./Tag";
import type { ProjectFrontmatter } from "@/lib/content-schemas";

interface WorkCardProps {
  slug: string;
  project: ProjectFrontmatter;
}

// Status indicator for the meta row. In-progress gets an active moss dot + label;
// forthcoming gets a plain label (the card is also dimmed). Complete is left unmarked,
// so its absence is what distinguishes a finished project from one still in flight.
function StatusIndicator({ status }: { status: ProjectFrontmatter["status"] }) {
  if (status === "in-progress") {
    return (
      <span className="inline-flex items-center gap-[6px] text-muted tracking-[0.02em] whitespace-nowrap shrink-0">
        <span
          className="inline-block w-[6px] h-[6px] rounded-full bg-accent shrink-0"
          aria-hidden="true"
        />
        In progress
      </span>
    );
  }
  if (status === "forthcoming") {
    return <span className="text-muted tracking-[0.02em] whitespace-nowrap shrink-0">Forthcoming</span>;
  }
  return null;
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
        <StatusIndicator status={project.status} />
        {project.tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
    </Link>
  );
}
