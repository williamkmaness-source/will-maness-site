// route.ts — Equity Tracker API route.
// Fetches two 30-day windows in parallel (current + prior year) for YoY comparison.
// Note: Analyze Boston migrated from Socrata to CKAN/OpenGov; data is split per-year by
// case-open year. The window filter is on closed_dt, so we must query every year resource
// whose cases could plausibly close in the window (a case opened in 2024 may close in 2026).
// Response is CDN-cached for 24 hours.

import type { NeighborhoodStat, RequestTypeMetrics, TrackerData } from "@/components/311/types";

const CKAN_SQL_URL =
  "https://data.boston.gov/api/3/action/datastore_search_sql";
const PAGE_SIZE = 50000;

// Per-year resource IDs from Analyze Boston. Indexed by case-open year.
const YEAR_RESOURCES: ReadonlyArray<readonly [number, string]> = [
  [2024, "dff4d804-5031-443a-8409-8344efd0e5c8"],
  [2025, "9d7c2214-4709-478a-a2e8-fb2020a5bb94"],
  [2026, "1a0b420d-99f1-4887-9851-990b2a5a6e17"],
];

type RawRow = {
  neighborhood?: string | null;
  reason?: string | null;
  open_dt?: string | null;
  closed_dt?: string | null;
  on_time?: string | null;
};

type CKANResponse = {
  success: boolean;
  result?: { records: RawRow[] };
  error?: { message?: string };
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// startDate/endDate must be ISO YYYY-MM-DD strings — we derive them from Date.toISOString
// in the caller, which guarantees no characters that would break the SQL string. Do not pass
// untrusted input here without a stricter validator (CKAN does not parameterize this endpoint).
async function fetchFromResource(
  resourceId: string,
  startDate: string,
  endDate: string
): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  let offset = 0;

  while (true) {
    const sql = [
      `SELECT neighborhood,reason,open_dt,closed_dt,on_time`,
      `FROM "${resourceId}"`,
      `WHERE case_status='Closed'`,
      `AND closed_dt >= '${startDate}'`,
      `AND closed_dt <= '${endDate}'`,
      `AND neighborhood IS NOT NULL`,
      `AND neighborhood != ''`,
      `LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    ].join(" ");

    const url = `${CKAN_SQL_URL}?sql=${encodeURIComponent(sql)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`CKAN API responded ${res.status}: ${res.statusText}`);
    }

    const json: CKANResponse = await res.json();
    if (!json.success || !json.result) {
      const msg = json.error?.message ?? "Unknown CKAN error";
      throw new Error(`CKAN API error: ${msg}`);
    }

    rows.push(...json.result.records);
    if (json.result.records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

// Fetches all year resources for a window in parallel.
async function fetchWindow(start: Date, end: Date): Promise<RawRow[]> {
  const startDate = toDateStr(start);
  const endDate = toDateStr(end);
  const results = await Promise.all(
    YEAR_RESOURCES.map(([, resourceId]) =>
      fetchFromResource(resourceId, startDate, endDate)
    )
  );
  return results.flat();
}

// Per-neighborhood aggregated data for a single window.
type NeighborhoodWindowData = {
  medianDays: number | null;
  onTimeRate: number;
  count: number;
};

// Per-request-type aggregated data for a single window.
type RequestTypeWindowData = {
  neighborhoods: Map<string, NeighborhoodWindowData>;
  cityMedian: number | null;
  equityGap: number | null;
  worstNeighborhood: string | null;
  worstMedianDays: number | null;
  bestNeighborhood: string | null;
  bestMedianDays: number | null;
  totalCases: number;
};

// Aggregates raw rows into per-type per-neighborhood metrics for a single window.
function computeWindow(rows: RawRow[]): Map<string, RequestTypeWindowData> {
  const byType = new Map<string, RawRow[]>();
  for (const row of rows) {
    if (!row.neighborhood?.trim()) continue;
    const type = row.reason ?? "Unknown";
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(row);
  }

  const result = new Map<string, RequestTypeWindowData>();

  for (const [requestType, typeRows] of byType) {
    const daysByNeighborhood = new Map<string, number[]>();
    const ontimeByNeighborhood = new Map<
      string,
      { ontime: number; total: number }
    >();
    const allDays: number[] = [];

    for (const row of typeRows) {
      const n = row.neighborhood!.trim();

      if (!ontimeByNeighborhood.has(n))
        ontimeByNeighborhood.set(n, { ontime: 0, total: 0 });
      const ot = ontimeByNeighborhood.get(n)!;
      ot.total++;
      if (row.on_time === "ONTIME") ot.ontime++;

      if (!row.closed_dt || !row.open_dt) continue;
      const days =
        (new Date(row.closed_dt).getTime() -
          new Date(row.open_dt).getTime()) /
        86400000;
      if (days < 0) continue;

      if (!daysByNeighborhood.has(n)) daysByNeighborhood.set(n, []);
      daysByNeighborhood.get(n)!.push(days);
      allDays.push(days);
    }

    const neighborhoods = new Map<string, NeighborhoodWindowData>();
    for (const [name, days] of daysByNeighborhood) {
      const ot = ontimeByNeighborhood.get(name);
      neighborhoods.set(name, {
        medianDays: median(days),
        onTimeRate: ot ? ot.ontime / ot.total : 0,
        count: ot?.total ?? days.length,
      });
    }

    const sorted = Array.from(neighborhoods.entries())
      .filter(([, v]) => v.medianDays !== null)
      .sort(([, a], [, b]) => (b.medianDays ?? 0) - (a.medianDays ?? 0));

    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    const equityGap =
      worst && best && (best[1].medianDays ?? 0) > 0
        ? (worst[1].medianDays ?? 0) / (best[1].medianDays ?? 0)
        : null;

    result.set(requestType, {
      neighborhoods,
      cityMedian: median(allDays),
      equityGap,
      worstNeighborhood: worst?.[0] ?? null,
      worstMedianDays: worst?.[1].medianDays ?? null,
      bestNeighborhood: best?.[0] ?? null,
      bestMedianDays: best?.[1].medianDays ?? null,
      totalCases: typeRows.length,
    });
  }

  return result;
}

// Joins current and prior windows to produce final RequestTypeMetrics[].
function mergeWindows(
  current: Map<string, RequestTypeWindowData>,
  prior: Map<string, RequestTypeWindowData>
): RequestTypeMetrics[] {
  const results: RequestTypeMetrics[] = [];

  for (const [requestType, curr] of current) {
    const priorType = prior.get(requestType);

    const neighborhoods: NeighborhoodStat[] = Array.from(
      curr.neighborhoods.entries()
    )
      .map(([name, data]) => {
        const priorN = priorType?.neighborhoods.get(name) ?? null;
        const yoyDeltaDays =
          data.medianDays != null && priorN?.medianDays != null
            ? data.medianDays - priorN.medianDays
            : null;
        const yoyDeltaOnTime =
          priorN != null ? data.onTimeRate - priorN.onTimeRate : null;
        return {
          neighborhood: name,
          medianDays: data.medianDays ?? 0,
          onTimeRate: data.onTimeRate,
          count: data.count,
          yoyDeltaDays,
          yoyDeltaOnTime,
        };
      })
      .sort((a, b) => b.medianDays - a.medianDays);

    results.push({
      requestType,
      equityGap: curr.equityGap,
      worstNeighborhood: curr.worstNeighborhood,
      worstMedianDays: curr.worstMedianDays,
      bestNeighborhood: curr.bestNeighborhood,
      bestMedianDays: curr.bestMedianDays,
      cityMedian: curr.cityMedian,
      totalCases: curr.totalCases,
      neighborhoods,
      yoyEquityGap: priorType?.equityGap ?? null,
    });
  }

  results.sort((a, b) => b.totalCases - a.totalCases);
  return results;
}

export async function GET() {
  const windowEnd = new Date();
  const windowStart = new Date(
    windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000
  );
  const priorEnd = new Date(windowEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
  const priorStart = new Date(
    windowStart.getTime() - 365 * 24 * 60 * 60 * 1000
  );

  try {
    const [currentRows, priorRows] = await Promise.all([
      fetchWindow(windowStart, windowEnd),
      fetchWindow(priorStart, priorEnd),
    ]);

    const currentWindow = computeWindow(currentRows);
    const priorWindow = computeWindow(priorRows);
    const requestTypes = mergeWindows(currentWindow, priorWindow);

    const payload: TrackerData = {
      lastUpdated: new Date().toISOString(),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      featured: requestTypes[0] ?? null,
      requestTypes,
    };

    return Response.json(payload, {
      headers: {
        "Cache-Control": "s-maxage=86400, stale-while-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
