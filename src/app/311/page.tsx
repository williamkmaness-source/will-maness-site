// app/311/page.tsx — Boston 311 Equity Tracker page.
// Server component. Wraps the client-side DataProvider around the HeadlineCard.
// DataProvider fetches /api/311-data on mount; child components read via context.

import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { DataProvider } from "@/components/311/DataProvider";
import { HeadlineCard } from "@/components/311/HeadlineCard";

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
          <p className="mt-[6px] text-hint">
            Note: This tracker uses the 2015–2024 Analyze Boston endpoint.
            2025 data is excluded pending Boston&apos;s ongoing backend
            migration.
          </p>
        </footer>
      </DataProvider>
    </Container>
  );
}
