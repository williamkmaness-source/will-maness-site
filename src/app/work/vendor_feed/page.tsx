// app/work/vendor_feed/page.tsx — public market intelligence feed.
// Server component reads initial filter state from URL searchParams and passes them
// to FeedClient so entity cards are server-rendered with the correct filter on first load.

import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getFeedEntities } from "@/lib/vendor-feed/feed-queries";
import { FeedClient } from "./FeedClient";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Vendor Intelligence Feed — Will Maness",
  description:
    "Automated market intelligence tracking feature launches, pricing changes, partnerships, and architecture shifts across data integration companies.",
};

type PageSearchParams = Promise<{ companies?: string; types?: string }>;

export default async function VendorFeedPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const [{ entities, totalCount }, params] = await Promise.all([
    getFeedEntities(),
    searchParams,
  ]);

  const initialCompanies = params.companies?.split(",").filter(Boolean) ?? [];
  const initialTypes = params.types?.split(",").filter(Boolean) ?? [];

  return (
    <Container>
      <div className="mb-[48px]">
        <div className="flex items-center justify-between mb-[16px]">
          <SectionLabel>Live feed</SectionLabel>
          <Link
            href="/work"
            className="font-mono text-[12px] text-muted no-underline hover:text-accent transition-colors duration-[120ms]"
          >
            ← All projects
          </Link>
        </div>
        <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mb-[16px]">
          Vendor intelligence
        </h1>
        <p className="font-sans text-[16px] leading-[1.65] text-ink-soft max-w-[580px]">
          Automated tracking of feature launches, pricing changes, partnerships, and architecture
          shifts across data integration and ingestion companies — updated daily.
        </p>
      </div>

      {entities.length === 0 ? (
        <div className="py-[80px] text-center mb-[96px]">
          <p className="font-serif text-[20px] text-muted mb-[12px]">No entities yet.</p>
          <p className="font-sans text-[14px] text-hint">
            The pipeline runs daily. Check back after the first run.
          </p>
        </div>
      ) : (
        <FeedClient
          entities={entities}
          totalCount={totalCount}
          initialCompanies={initialCompanies}
          initialTypes={initialTypes}
        />
      )}
    </Container>
  );
}
