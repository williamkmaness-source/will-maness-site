"use client";

// BostonCivicTracker — embeds the 311 Equity Tracker inline on the work/boston-civic-data page.
// Renders two self-contained widgets stacked under a shared DataProvider so a category
// selection in either FilterBar updates both charts. Children passed in slot between the
// two containers so MDX can drop editorial commentary in.
// Registered as an MDX component.

import type { ReactNode } from "react";
import { DataProvider } from "@/components/311/DataProvider";
import { HeadlineCard } from "@/components/311/HeadlineCard";
import { BacklogHeadlineCard } from "@/components/311/BacklogHeadlineCard";
import { FilterBar } from "@/components/311/FilterBar";
import { NeighborhoodRanking } from "@/components/311/NeighborhoodRanking";
import { BacklogFlowChart } from "@/components/311/BacklogFlowChart";

function TrackerContainer({ children }: { children: ReactNode }) {
  return (
    <div className="border border-line rounded-[6px] overflow-hidden">
      <div className="px-[4px] py-[10px] border-b border-line bg-accent-soft">
        <p className="font-mono text-[11px] tracking-[0.06em] uppercase text-hint text-center">
          Live tracker · Updated daily
        </p>
      </div>
      <div className="px-[24px] pt-[32px] pb-[8px]">{children}</div>
    </div>
  );
}

function DataFooter() {
  return (
    <footer className="py-[24px] border-t border-line font-mono text-[11px] tracking-[0.04em] text-hint">
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
  );
}

export function BostonCivicTracker({ children }: { children?: ReactNode }) {
  return (
    <div className="my-[48px]">
      <DataProvider>
        <TrackerContainer>
          <BacklogHeadlineCard />
          <FilterBar variant="backlog" />
          <BacklogFlowChart />
          <DataFooter />
        </TrackerContainer>

        {children && <div className="my-[48px]">{children}</div>}

        <div className={children ? "" : "mt-[48px]"}>
          <TrackerContainer>
            <HeadlineCard />
            <FilterBar />
            <NeighborhoodRanking />
            <DataFooter />
          </TrackerContainer>
        </div>
      </DataProvider>
    </div>
  );
}
