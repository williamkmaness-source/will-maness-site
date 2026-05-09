"use client";

// BostonCivicTracker — embeds the 311 Equity Tracker inline on the work/boston-civic-data page.
// Registered as an MDX component so it can be dropped into the project writeup.

import { DataProvider } from "@/components/311/DataProvider";
import { HeadlineCard } from "@/components/311/HeadlineCard";
import { FilterBar } from "@/components/311/FilterBar";
import { NeighborhoodRanking } from "@/components/311/NeighborhoodRanking";
import { BacklogFlowChart } from "@/components/311/BacklogFlowChart";

export function BostonCivicTracker() {
  return (
    <div className="my-[48px] border border-line rounded-[6px] overflow-hidden">
      <div className="px-[4px] py-[10px] border-b border-line bg-accent-soft">
        <p className="font-mono text-[11px] tracking-[0.06em] uppercase text-hint text-center">
          Live tracker · Updated daily
        </p>
      </div>
      <div className="px-[24px] pt-[32px] pb-[8px]">
        <DataProvider>
          <HeadlineCard />
          <FilterBar />
          <NeighborhoodRanking />
          <BacklogFlowChart />
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
        </DataProvider>
      </div>
    </div>
  );
}
