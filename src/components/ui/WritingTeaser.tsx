// WritingTeaser.tsx — a writing post teaser in the homepage "Recent writing" list and /writing index.
// Renders date, title, dek, and a "Read essay →" link.
// Text comes from MDX frontmatter — nothing hardcoded here.

import Link from "next/link";
import type { WritingFrontmatter } from "@/lib/content-schemas";

interface WritingTeaserProps {
  slug: string;
  post: WritingFrontmatter;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function WritingTeaser({ slug, post }: WritingTeaserProps) {
  return (
    <article>
      <div className="font-mono text-[12px] text-hint tracking-[0.02em] mb-[12px]">
        {formatDate(post.date)}
        {post.readTime && <span> · {post.readTime}</span>}
      </div>
      <h3 className="font-serif text-[24px] font-medium leading-[1.3] tracking-[-0.01em] text-ink mb-[12px]">
        <Link
          href={`/writing/${slug}`}
          className="no-underline hover:text-accent transition-colors duration-[120ms]"
        >
          {post.title}
        </Link>
      </h3>
      <p className="font-sans text-[15px] leading-[1.65] text-ink-soft mb-[12px]">
        {post.dek}
      </p>
      <Link
        href={`/writing/${slug}`}
        className="font-sans text-[14px] text-accent no-underline border-b border-accent/50 pb-[1px] hover:border-accent transition-colors duration-[120ms]"
      >
        Read essay →
      </Link>
    </article>
  );
}
