// app/writing/[slug]/page.tsx — individual writing post template.
// Same typography and structure as the project page, without eyebrow or "self-initiated" pill.
// Body prose imported as a React component from the MDX file.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { getAllPosts, getAdjacentPosts } from "@/lib/content";
import type { Metadata } from "next";
import matter from "gray-matter";
import fs from "fs";
import path from "path";

interface Props {
  params: Promise<{ slug: string }>;
}

function getPost(slug: string) {
  const dir = path.join(process.cwd(), "content", "writing");
  const filePath = path.join(dir, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return undefined;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data } = matter(raw);
  return data as { title: string; date: string; dek: string; readTime?: string };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Will Maness`,
    description: post.dek,
  };
}

export default async function WritingPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const { prev, next } = getAdjacentPosts(slug);

  const { default: PostContent } = await import(
    `../../../../content/writing/${slug}.mdx`
  );

  return (
    <Container>
      {/* Breadcrumb */}
      <div className="font-mono text-[12px] text-muted tracking-[0.02em] mb-[32px]">
        <Link href="/writing" className="text-muted no-underline hover:text-accent transition-colors duration-[120ms]">
          ← All essays
        </Link>
      </div>

      <article style={{ maxWidth: "680px", margin: "0 auto" }}>
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-[56px]">
          <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mb-[24px]">
            {post.title}
          </h1>
          <p className="font-serif text-[21px] italic leading-[1.45] text-muted mb-[36px]">
            {post.dek}
          </p>
          <div className="flex gap-[18px] items-center py-[14px] border-t border-b border-line font-sans text-[13px] text-muted">
            <span>{formatDate(post.date)}</span>
            {post.readTime && (
              <>
                <span className="text-line-strong">·</span>
                <span>{post.readTime}</span>
              </>
            )}
          </div>
        </div>

        {/* ── Body prose ────────────────────────────────────────────── */}
        <PostContent />

        {/* ── Prev / next navigation ────────────────────────────────── */}
        {(prev || next) && (
          <div
            className="grid gap-[24px] mt-[96px] border-t border-line pt-[32px]"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            {prev ? (
              <Link href={`/writing/${prev.slug}`} className="no-underline text-ink group">
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
              <Link href={`/writing/${next.slug}`} className="no-underline text-ink text-right group">
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
