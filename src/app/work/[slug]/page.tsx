// app/work/[slug]/page.tsx — individual project page template.
// Replicates site-project-page.html exactly.
// Header data (eyebrow, title, summary, year, tags) from MDX frontmatter via getAllProjects().
// Body prose imported as a React component from the MDX file (frontmatter stripped by remark-frontmatter).
// Next/prev navigation uses getAdjacentProjects().

import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Tag } from "@/components/ui/Tag";
import { getAllProjects, getProject, getAdjacentProjects } from "@/lib/content";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.title} — Will Maness`,
    description: project.summary,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const { prev, next } = getAdjacentProjects(slug);

  // Dynamic import: @next/mdx compiles each content file at build time.
  // remark-frontmatter strips the ---...--- block so only the body renders.
  const { default: ProjectContent } = await import(
    `../../../../content/projects/${slug}.mdx`
  );

  return (
    <Container>
      {/* Breadcrumb */}
      <div className="font-mono text-[12px] text-muted tracking-[0.02em] mb-[32px]">
        <Link href="/work" className="text-muted no-underline hover:text-accent transition-colors duration-[120ms]">
          ← All projects
        </Link>
      </div>

      <article style={{ maxWidth: "680px", margin: "0 auto" }}>
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-[56px]">
          <p className="font-mono text-[12px] text-clay tracking-[0.06em] uppercase mb-[20px]">
            {project.eyebrow}
          </p>
          <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mb-[24px]">
            {project.title}
          </h1>
          <p className="font-serif text-[21px] italic leading-[1.45] text-muted mb-[36px]">
            {project.summary}
          </p>
          <div className="flex gap-[18px] items-center py-[14px] border-t border-b border-line font-sans text-[13px] text-muted">
            <span>{project.year}</span>
            <span className="text-line-strong">·</span>
            {project.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            <span className="text-line-strong">·</span>
            <span className="bg-accent-soft text-muted px-[9px] py-[3px] rounded-sm text-[11px]">
              self-initiated
            </span>
          </div>
        </div>

        {/* ── Body prose ────────────────────────────────────────────── */}
        <ProjectContent />

        {/* ── Prev / next navigation ────────────────────────────────── */}
        {(prev || next) && (
          <div
            className="grid gap-[24px] mt-[96px] border-t border-line pt-[32px]"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            {prev ? (
              <Link href={`/work/${prev.slug}`} className="no-underline text-ink group">
                <p className="font-mono text-[11px] text-muted tracking-[0.06em] uppercase mb-[6px]">
                  ← Previous
                </p>
                <p className="font-serif text-[19px] font-medium leading-[1.3] group-hover:text-accent transition-colors duration-[120ms]">
                  {prev.title}
                </p>
              </Link>
            ) : (
              <div />
            )}
            {next && (
              <Link href={`/work/${next.slug}`} className="no-underline text-ink text-right group">
                <p className="font-mono text-[11px] text-muted tracking-[0.06em] uppercase mb-[6px]">
                  Next →
                </p>
                <p className="font-serif text-[19px] font-medium leading-[1.3] group-hover:text-accent transition-colors duration-[120ms]">
                  {next.title}
                </p>
              </Link>
            )}
          </div>
        )}
      </article>
    </Container>
  );
}
