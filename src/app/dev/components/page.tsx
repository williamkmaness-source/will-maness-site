// _dev/components/page.tsx — visual inventory of every UI primitive.
// Only accessible in development (NODE_ENV check redirects in production).
// Use this to spot-check a component in isolation before using it in a real page.
// The underscore prefix on _dev tells Next.js to exclude it from route generation
// in some configurations, but the NODE_ENV guard is the real protection.

import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Stack } from "@/components/layout/Stack";
import { Prose } from "@/components/ui/Prose";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { MetaStrip } from "@/components/ui/MetaStrip";
import { Tag } from "@/components/ui/Tag";
import { ClayDot } from "@/components/ui/ClayDot";

export default function ComponentGallery() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <Container className="py-[64px]">
      <h1 className="font-serif text-[32px] font-medium text-ink mb-[64px]">
        Component Gallery
      </h1>

      <section className="mb-[64px]">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted mb-[24px]">
          Colors
        </h2>
        <div className="flex flex-wrap gap-[12px]">
          {[
            ["bg", "#F7F3EC"],
            ["bg-soft", "#EFE9DD"],
            ["bg-code", "#F1ECE0"],
            ["ink", "#1F1E1A"],
            ["muted", "#6B665B"],
            ["hint", "#8A8478"],
            ["accent", "#2D4A3E"],
            ["accent-soft", "#ECE4D2"],
            ["clay", "#B85C38"],
            ["line", "#E5DFD3"],
          ].map(([name, hex]) => (
            <div key={name} className="flex flex-col gap-[6px]">
              <div
                className="w-[72px] h-[48px] rounded-sm border border-line"
                style={{ backgroundColor: hex }}
              />
              <span className="font-mono text-[10px] text-muted">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-[64px] border-t border-line pt-[40px]">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted mb-[24px]">
          Typography
        </h2>
        <Stack gap="lg">
          <p className="font-serif text-[52px] font-medium leading-[1.15] tracking-[-0.015em] text-ink">
            Display XL · Newsreader 52/500
          </p>
          <p className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink">
            Display LG · Newsreader 44/500
          </p>
          <p className="font-serif text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink">
            H2 · Newsreader 28/500
          </p>
          <p className="font-serif text-[21px] italic leading-[1.45] text-muted">
            Dek · Newsreader italic 21/400
          </p>
          <p className="font-serif text-[18px] leading-[1.65] text-prose">
            Body prose · Newsreader 18/400 — the main reading size for project
            pages and writing posts.
          </p>
          <p className="font-sans text-[14px] leading-[1.5] text-ink">
            UI · System sans 14/400
          </p>
          <p className="font-mono text-[12px] leading-[1.5] tracking-[0.06em] uppercase text-muted">
            Label · Mono 12/500 uppercase
          </p>
          <p className="font-mono text-[12px] leading-[1.5] tracking-[0.06em] uppercase text-clay">
            Eyebrow · Mono 12 clay
          </p>
        </Stack>
      </section>

      <section className="mb-[64px] border-t border-line pt-[40px]">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted mb-[24px]">
          UI Primitives
        </h2>
        <Stack gap="xl">
          <div>
            <p className="font-mono text-[11px] text-hint mb-[12px]">SectionLabel</p>
            <SectionLabel>Selected work</SectionLabel>
          </div>
          <div>
            <p className="font-mono text-[11px] text-hint mb-[12px]">Eyebrow</p>
            <Eyebrow>Engineering · Research</Eyebrow>
          </div>
          <div>
            <p className="font-mono text-[11px] text-hint mb-[12px]">MetaStrip</p>
            <MetaStrip date="Updated April 2026" readTime="14 min read" pill="self-initiated" />
          </div>
          <div>
            <p className="font-mono text-[11px] text-hint mb-[12px]">Tags</p>
            <div className="flex gap-[8px]">
              <Tag>engineering</Tag>
              <Tag>research</Tag>
              <Tag>data</Tag>
            </div>
          </div>
          <div>
            <p className="font-mono text-[11px] text-hint mb-[12px]">ClayDot</p>
            <div className="flex items-center gap-[10px] font-mono text-[12px] text-muted">
              <ClayDot />
              currently in Boston · Eastern time
            </div>
          </div>
        </Stack>
      </section>

      <section className="mb-[64px] border-t border-line pt-[40px]">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted mb-[24px]">
          Prose
        </h2>
        <Prose>
          <p>
            This is body prose at 18px Newsreader. The quick brown fox jumps over the lazy dog.{" "}
            <em>Italic text looks like this.</em> And <a href="#">links look like this</a> with an
            accent-colored underline.
          </p>
          <h2>This is an H2 heading</h2>
          <p>
            Paragraph following a heading. Note the top margin on the heading creates breathing
            room. Inline <code>code</code> has a warm background and mono font.
          </p>
          <blockquote>
            The most useful upgrade wasn&apos;t a new model. It was getting the inner loop down to
            under five seconds.
          </blockquote>
          <p>Text after a blockquote.</p>
        </Prose>
      </section>
    </Container>
  );
}
