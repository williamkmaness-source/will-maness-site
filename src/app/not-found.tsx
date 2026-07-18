// app/not-found.tsx — custom 404. Renders inside the global Nav/Footer frame
// (from app/layout.tsx) so an unmatched route keeps the site chrome instead of
// falling through to Next's bare default. Reuses Container and the standard
// page-header type scale; one line of copy and a link back home.

import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";

export default function NotFound() {
  return (
    <Container>
      <div className="py-[96px] max-w-[580px]">
        <SectionLabel>404</SectionLabel>
        <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mt-[16px] mb-[20px]">
          This page doesn&rsquo;t exist.
        </h1>
        <p className="font-sans text-[16px] leading-[1.65] text-ink-soft mb-[32px]">
          The link may be broken or the page may have moved. Everything worth
          finding is one step back.
        </p>
        <Link
          href="/"
          className="font-mono text-[13px] text-accent no-underline hover:underline"
        >
          ← Back home
        </Link>
      </div>
    </Container>
  );
}
