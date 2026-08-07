// app/work/music_analyzer/page.tsx — the standalone music analyzer app route (issue #216).
// Server component; all three views (lookup, compare, top 100) live in the client tab
// shell. Mirrors the /work/vendor_feed pattern: a full-width app route alongside the
// narrative MDX project page at /work/music-analyzer.

import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { MusicAnalyzerTabs } from "@/components/projects/music-analyzer/MusicAnalyzerTabs";
import { getProject } from "@/lib/content";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const SLUG = "music-analyzer";

export async function generateMetadata(): Promise<Metadata> {
  const project = getProject(SLUG);
  return {
    title: `${project?.title ?? "Music analyzer"} — Will Maness`,
    description: project?.summary,
  };
}

export default function MusicAnalyzerPage() {
  const project = getProject(SLUG);

  return (
    <Container>
      <div className="mb-[48px]">
        <div className="flex items-center justify-between mb-[16px]">
          <SectionLabel>{project?.eyebrow}</SectionLabel>
          <Link
            href={`/work/${SLUG}`}
            className="font-mono text-[12px] text-muted no-underline hover:text-accent transition-colors duration-[120ms]"
          >
            ← About this project
          </Link>
        </div>
        <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mb-[16px]">
          {project?.title}
        </h1>
        <p className="font-sans text-[16px] leading-[1.65] text-ink-soft max-w-[580px]">
          {project?.summary}
        </p>
      </div>

      <div className="mb-[96px]">
        <MusicAnalyzerTabs />
      </div>
    </Container>
  );
}
