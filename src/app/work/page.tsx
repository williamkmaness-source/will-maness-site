// app/work/page.tsx — work index. Shows all projects ordered by year descending.
// Status indicators (in progress / complete / forthcoming) are driven by frontmatter.
// Same WorkCard pattern as the homepage Selected Work strip, but shows everything.

import { Container } from "@/components/layout/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { WorkCard } from "@/components/ui/WorkCard";
import { getAllProjects } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Work — Will Maness",
  description: "Projects and writing by Will Maness.",
};

export default function WorkPage() {
  const projects = getAllProjects();

  return (
    <Container>
      <div className="mb-[56px]">
        <SectionLabel>Work</SectionLabel>
        <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mt-[16px]">
          Selected projects
        </h1>
      </div>

      <div
        className="grid gap-y-[56px] gap-x-[64px] mb-[96px]"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        {projects.map((project) => (
          <WorkCard key={project.slug} slug={project.slug} project={project} />
        ))}
      </div>
    </Container>
  );
}
