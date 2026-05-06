// app/about/page.tsx — about page. Replicates site-about-page.html exactly.
// Structured data (currently list, say-hi copy) from content/site.mdx frontmatter.
// Bio prose from content/site.mdx MDX body, imported as a React component.
// The topographic SVG is a placeholder; Will replaces it with a headshot later.

import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { ClayDot } from "@/components/ui/ClayDot";
import { getSiteContent } from "@/lib/content";
import SiteProse from "../../../content/site.mdx";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Will Maness",
  description:
    "Strategy and operating background, spending time in the trenches with the AI-and-data stack.",
};

export default function AboutPage() {
  const site = getSiteContent();

  return (
    <Container>
      <article style={{ maxWidth: "720px", margin: "0 auto" }}>
        {/* ── Lede: mark + intro ───────────────────────────────────────── */}
        <div
          className="grid gap-[48px] items-start mb-[64px]"
          style={{ gridTemplateColumns: "200px 1fr" }}
        >
          {/* Topographic SVG placeholder — will be replaced with a portrait */}
          <div>
            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              width="200"
              height="200"
              aria-hidden="true"
            >
              <circle cx="100" cy="100" r="100" fill="#EFE9DD" />
              <path d="M22,138 Q60,118 100,128 T180,120" stroke="#2D4A3E" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.32" />
              <path d="M22,114 Q66,92 110,106 T180,96" stroke="#2D4A3E" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.45" />
              <path d="M22,90 Q72,68 118,82 T180,72" stroke="#2D4A3E" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
              <path d="M30,66 Q82,46 126,60 T180,48" stroke="#2D4A3E" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.78" />
              <path d="M40,42 Q90,26 134,38 T180,28" stroke="#2D4A3E" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.92" />
              <circle cx="108" cy="104" r="4.5" fill="#B85C38" />
            </svg>
            <p className="font-mono text-[11px] text-hint mt-[14px] leading-[1.5] tracking-[0.02em] max-w-[200px]">
              placeholder mark — final art TBD; portrait or commissioned illustration
            </p>
          </div>

          <div>
            <h1 className="font-serif text-[42px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mt-[4px] mb-[24px]">
              About
            </h1>
            <p className="font-serif text-[19px] leading-[1.55] text-ink">
              {site.aboutIntro}
            </p>
          </div>
        </div>

        {/* ── Bio prose (MDX body from content/site.mdx) ───────────────── */}
        <div className="font-serif text-[18px] leading-[1.65] text-prose">
          <SiteProse />
        </div>

        {/* ── Currently ────────────────────────────────────────────────── */}
        <div className="mt-[72px] border-t border-line pt-[40px]">
          <p className="font-mono text-[11px] text-muted font-medium tracking-[0.06em] uppercase mb-[24px]">
            Currently
          </p>
          <div>
            {site.currentlyList.map((item) => (
              <div
                key={item.label}
                className="grid gap-[16px] items-baseline py-[14px] border-b border-line last:border-b-0"
                style={{ gridTemplateColumns: "130px 1fr" }}
              >
                <span className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase">
                  {item.label}
                </span>
                <span className="font-serif text-[17px] text-prose leading-[1.5]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Elsewhere ────────────────────────────────────────────────── */}
        <div className="mt-[72px] border-t border-line pt-[40px]">
          <p className="font-mono text-[11px] text-muted font-medium tracking-[0.06em] uppercase mb-[24px]">
            Elsewhere on the internet
          </p>
          <div
            className="grid gap-y-0 gap-x-[32px]"
            style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
          >
            {[
              { label: "GitHub", handle: "@wkmaness", href: "https://github.com/wkmaness" },
              { label: "LinkedIn", handle: "in/willmaness", href: "https://linkedin.com/in/willmaness" },
              { label: "Twitter", handle: "@willmaness", href: "https://twitter.com/willmaness" },
              { label: "RSS", handle: "/feed.xml", href: "/feed.xml" },
            ].map(({ label, handle, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-baseline gap-[12px] no-underline py-[10px] border-b border-line hover:text-accent transition-colors duration-[120ms] group"
                {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                <span className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase min-w-[70px]">
                  {label}
                </span>
                <span className="font-serif text-[17px] text-ink group-hover:text-accent transition-colors duration-[120ms]">
                  {handle}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Say hi ───────────────────────────────────────────────────── */}
        <div
          id="say-hi"
          className="bg-bg-soft rounded-xl px-[36px] py-[32px] mt-[72px]"
        >
          <p className="font-mono text-[11px] text-muted tracking-[0.06em] uppercase mb-[14px]">
            Saying hi
          </p>
          <h2 className="font-serif text-[28px] font-medium leading-[1.2] tracking-[-0.01em] text-ink mb-[16px]">
            {site.sayHiHeadline}
          </h2>
          <p className="font-serif text-[17px] leading-[1.55] text-prose mb-[24px]">
            {site.sayHiBody}
          </p>
          <div className="flex items-center gap-[12px] flex-wrap">
            <Link
              href="mailto:will@willmaness.com"
              className="bg-accent text-bg no-underline px-[18px] py-[10px] rounded-md font-sans text-[14px] font-medium tracking-[0.01em] hover:opacity-90 transition-opacity"
            >
              will@willmaness.com
            </Link>
            <Link
              href={site.calUrl}
              className="bg-transparent text-ink no-underline px-[18px] py-[10px] rounded-md font-sans text-[14px] font-medium border border-ink hover:border-accent hover:text-accent transition-colors duration-[120ms]"
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a call →
            </Link>
          </div>
          <div className="inline-flex items-center gap-[10px] mt-[20px] font-mono text-[12px] text-muted tracking-[0.02em]">
            <ClayDot />
            currently in Boston · mostly on Eastern time
          </div>
        </div>
      </article>
    </Container>
  );
}
