// app/writing/page.tsx — writing index. Shows all posts ordered newest first.
// Same WritingTeaser pattern as the homepage Recent Writing strip, but shows everything.

import { Container } from "@/components/layout/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { WritingTeaser } from "@/components/ui/WritingTeaser";
import { getAllPosts } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Writing — Will Maness",
  description: "Essays on AI infrastructure, data tooling, and product strategy by Will Maness.",
};

export default function WritingPage() {
  const posts = getAllPosts();

  return (
    <Container>
      <div className="mb-[56px]">
        <SectionLabel>Writing</SectionLabel>
        <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mt-[16px]">
          Essays
        </h1>
      </div>

      {posts.length === 0 ? (
        <p className="font-serif text-[18px] text-muted">Essays coming soon.</p>
      ) : (
        <div className="flex flex-col gap-[40px] max-w-[720px] mb-[96px]">
          {posts.map((post) => (
            <WritingTeaser key={post.slug} slug={post.slug} post={post} />
          ))}
        </div>
      )}
    </Container>
  );
}
