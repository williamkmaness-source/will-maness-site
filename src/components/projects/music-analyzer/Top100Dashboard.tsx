"use client";

// Top100Dashboard.tsx — the aggregate view over the current Billboard snapshot (issue #218).
// Fetches the week's 100 precomputed tracks once, then filters in memory so narrowing by
// feature is instant. Filter options are derived from the data, so a value the chart
// doesn't contain this week never appears as an empty option.

import { useEffect, useMemo, useState } from "react";
import {
  FEATURE_NAMES,
  type FeatureName,
  type FeatureRating,
} from "@/lib/music-analyzer/music-queries";
import { FeatureRatingBadge } from "./FeatureRatingBadge";
import { FEATURE_LABEL } from "./labels";

const COPY = {
  loading: "Loading this week's top 100…",
  error: "The top 100 isn't available right now. Check back after the next pipeline run.",
  empty:
    "No snapshot yet — the weekly pipeline hasn't scraped a chart. This fills in on its first run.",
  clear: "Clear filters",
  rank: "#",
  song: "Song",
  allValues: "Any",
} as const;

interface ScoredFeature {
  name: FeatureName;
  value: string | null;
  rating: FeatureRating | null;
  count: number | null;
}

interface DashboardTrack {
  rank: number;
  title: string;
  artist: string;
  features: ScoredFeature[];
}

interface Top100Response {
  snapshotWeek: string | null;
  totalCount: number;
  tracks: DashboardTrack[];
}

type Filters = Partial<Record<FeatureName, string>>;

function featureValue(track: DashboardTrack, name: FeatureName): ScoredFeature | undefined {
  return track.features.find((f) => f.name === name);
}

// snapshot_week is a Postgres `date` serialized as "YYYY-MM-DD", which Date parses as
// UTC midnight. Formatting in the viewer's local zone would render the previous day for
// anyone west of UTC, so the date is formatted in UTC to match the stored chart week.
function formatWeek(week: string): string {
  const d = new Date(week);
  if (isNaN(d.getTime())) return week;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function Top100Dashboard() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<Top100Response | null>(null);
  const [filters, setFilters] = useState<Filters>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/music/top100");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Top100Response;
        if (!cancelled) {
          setData(json);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    const result = {} as Record<FeatureName, string[]>;
    for (const name of FEATURE_NAMES) {
      const values = new Set<string>();
      for (const track of data?.tracks ?? []) {
        const value = featureValue(track, name)?.value;
        if (value) values.add(value);
      }
      result[name] = [...values].sort();
    }
    return result;
  }, [data]);

  const visible = useMemo(() => {
    const active = Object.entries(filters) as [FeatureName, string][];
    return (data?.tracks ?? []).filter((track) =>
      active.every(([name, value]) => featureValue(track, name)?.value === value)
    );
  }, [data, filters]);

  const hasFilters = Object.keys(filters).length > 0;

  if (status === "loading") {
    return <p className="font-sans text-[14px] text-muted py-[40px]">{COPY.loading}</p>;
  }
  if (status === "error") {
    return <p className="font-sans text-[14px] text-muted py-[40px]">{COPY.error}</p>;
  }
  if (!data || data.tracks.length === 0) {
    return <p className="font-sans text-[14px] text-muted py-[40px]">{COPY.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex flex-wrap items-end gap-[14px]">
        {FEATURE_NAMES.map((name) => (
          <label key={name} className="flex flex-col gap-[5px]">
            <span className="font-mono text-[11px] text-hint tracking-[0.04em] uppercase">
              {FEATURE_LABEL[name]}
            </span>
            <select
              value={filters[name] ?? ""}
              onChange={(e) =>
                setFilters((prev) => {
                  const next = { ...prev };
                  if (e.target.value) next[name] = e.target.value;
                  else delete next[name];
                  return next;
                })
              }
              className="font-sans text-[14px] text-ink bg-bg border border-line-strong rounded-sm px-[9px] py-[6px] outline-none focus:border-accent transition-colors duration-[120ms]"
            >
              <option value="">{COPY.allValues}</option>
              {options[name].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ))}
        {hasFilters && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="font-mono text-[12px] text-muted border border-line-strong rounded-sm px-[10px] py-[6px] hover:text-accent hover:border-accent transition-colors duration-[120ms]"
          >
            {COPY.clear}
          </button>
        )}
      </div>

      <p className="font-mono text-[12px] text-hint">
        {visible.length} of {data.totalCount}
        {data.snapshotWeek ? ` · week of ${formatWeek(data.snapshotWeek)}` : ""}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-line-strong">
              <th className="text-left font-mono text-[11px] text-hint tracking-[0.04em] uppercase py-[8px] pr-[12px]">
                {COPY.rank}
              </th>
              <th className="text-left font-mono text-[11px] text-hint tracking-[0.04em] uppercase py-[8px] pr-[12px]">
                {COPY.song}
              </th>
              {FEATURE_NAMES.map((name) => (
                <th
                  key={name}
                  className="text-left font-mono text-[11px] text-hint tracking-[0.04em] uppercase py-[8px] pr-[12px]"
                >
                  {FEATURE_LABEL[name]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((track) => (
              <tr key={track.rank} className="border-b border-line align-top">
                <td className="font-mono text-[12px] text-hint py-[10px] pr-[12px]">
                  {track.rank}
                </td>
                <td className="py-[10px] pr-[12px]">
                  <span className="font-serif text-[16px] text-ink block leading-[1.35]">
                    {track.title}
                  </span>
                  <span className="font-sans text-[13px] text-muted">{track.artist}</span>
                </td>
                {FEATURE_NAMES.map((name) => {
                  const feature = featureValue(track, name);
                  return (
                    <td key={name} className="py-[10px] pr-[12px]">
                      <span className="font-sans text-[14px] text-ink block mb-[4px]">
                        {feature?.value ?? "—"}
                      </span>
                      <FeatureRatingBadge
                        rating={feature?.rating ?? null}
                        count={feature?.count ?? null}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
