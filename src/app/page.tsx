// app/page.tsx — homepage. Replicates site-mockup.html exactly.
// All copy pulled from content/site.mdx (via getSiteContent) and the
// projects/writing collections (via getFeaturedProjects, getRecentPosts).
// No human-readable text is hardcoded here.

import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { ClayDot } from "@/components/ui/ClayDot";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { WorkCard } from "@/components/ui/WorkCard";
import { WritingTeaser } from "@/components/ui/WritingTeaser";
import { getSiteContent } from "@/lib/content";
import { getFeaturedProjects } from "@/lib/content";
import { getRecentPosts } from "@/lib/content";

export default function HomePage() {
  const site = getSiteContent();
  const featuredProjects = getFeaturedProjects();
  const recentPosts = getRecentPosts(3);

  return (
    <Container>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="max-w-[720px] mb-[140px]">
        <h1 className="font-serif text-[52px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mb-[28px]">
          {site.heroHeadline}{" "}
          <em className="text-accent italic">{site.heroHeadlineEm}</em>
        </h1>
        <p className="font-sans text-[17px] leading-[1.55] text-muted max-w-[540px]">
          {site.heroSub}
        </p>
        <div className="inline-flex items-center gap-[10px] mt-[28px] font-mono text-[12px] text-muted tracking-[0.02em]">
          <ClayDot />
          {site.currentlyLine}
        </div>
      </section>

      {/* ── Selected work ─────────────────────────────────────────────── */}
      <section className="mb-[96px]">
        <div className="flex items-baseline justify-between pb-[16px] mb-[36px] border-b border-line">
          <SectionLabel>Selected work</SectionLabel>
          <Link
            href="/work"
            className="font-sans text-[13px] text-ink no-underline hover:text-accent transition-colors duration-[120ms]"
          >
            All projects →
          </Link>
        </div>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-y-[56px] gap-x-[64px]"
        >
          {featuredProjects.map((project) => (
            <WorkCard key={project.slug} slug={project.slug} project={project} />
          ))}
        </div>
      </section>

      {/* ── Recent writing ────────────────────────────────────────────── */}
      {recentPosts.length > 0 && (
        <section className="mb-[96px]">
          <div className="flex items-baseline justify-between pb-[16px] mb-[36px] border-b border-line">
            <SectionLabel>Recent writing</SectionLabel>
            <Link
              href="/writing"
              className="font-sans text-[13px] text-ink no-underline hover:text-accent transition-colors duration-[120ms]"
            >
              All essays →
            </Link>
          </div>
          <div className="flex flex-col gap-[40px] max-w-[720px]">
            {recentPosts.map((post) => (
              <WritingTeaser key={post.slug} slug={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
