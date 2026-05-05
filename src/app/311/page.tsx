// app/311/page.tsx — Boston 311 Equity Tracker page.
// Server component. Wraps client-side DataProvider around the tracker components.
// DataProvider fetches /api/311-data once on mount; all filter interactions are in-memory.

import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { DataProvider } from "@/components/311/DataProvider";
import { HeadlineCard } from "@/components/311/HeadlineCard";
import { FilterBar } from "@/components/311/FilterBar";
import { NeighborhoodRanking } from "@/components/311/NeighborhoodRanking";

export const metadata: Metadata = {
  title: "311 Equity Tracker · Will Maness",
  description:
    "Does Boston respond to 311 requests fairly across neighborhoods? An Equity Gap Index built from public Analyze Boston data.",
};

export default function Page311() {
  return (
    <Container>
      <DataProvider>
        <HeadlineCard />
        <FilterBar />
        <NeighborhoodRanking />
        <footer className="py-[32px] border-t border-line font-mono text-[11px] tracking-[0.04em] text-hint">
          <p>
            Data:{" "}
            <a
              href="https://data.boston.gov/dataset/311-service-requests"
              className="underline underline-offset-2 hover:text-muted transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Analyze Boston
            </a>{" "}
            · City of Boston · Public Domain (PDDL 1.0) · Updated daily
          </p>
        </footer>
      </DataProvider>
    </Container>
  );
}
