"use client";

import { StaffingDashboard } from "./StaffingDashboard";

export function BostonCivicTracker() {
  return (
    <div className="my-[48px]">
      <div className="border border-line rounded-[6px] overflow-hidden">
        <div className="px-[4px] py-[10px] border-b border-line bg-accent-soft">
          <p className="font-mono text-[11px] tracking-[0.06em] uppercase text-hint text-center">
            Staffing Intelligence · Updated daily
          </p>
        </div>
        <div className="px-[24px] pt-[32px] pb-[8px]">
          <StaffingDashboard />
        </div>
      </div>
    </div>
  );
}
