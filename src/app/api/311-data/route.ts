// route.ts — Equity Tracker API route.
// Fetches two 30-day windows in parallel (current + prior year) for YoY comparison.
// Note: Analyze Boston migrated from Socrata to CKAN/OpenGov; data is split per-year by
// case-open year. We pull every case where open_dt OR closed_dt falls in the window,
// which feeds both the closed-case equity metrics and the BacklogFlowChart's opened/closed
// counts. Closed-status filtering happens in the aggregator, not the SQL.
// Response is CDN-cached for 24 hours.

import {
  ALL_CATEGORIES,
  type NeighborhoodStat,
  type RequestTypeMetrics,
  type TrackerData,
} from "@/components/311/types";

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
  case_status?: string | null;
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
      `SELECT neighborhood,reason,case_status,open_dt,closed_dt,on_time`,
      `FROM "${resourceId}"`,
      `WHERE ((open_dt >= '${startDate}' AND open_dt <= '${endDate}')`,
      `OR (closed_dt >= '${startDate}' AND closed_dt <= '${endDate}'))`,
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
  openedCount: number;
  closedCount: number;
};

// Per-request-type aggregated data for a single window.
type RequestTypeWindowData = {
  neighborhoods: Map<string, NeighborhoodWindowData>;
  cityMedian: number | null;
  equityGap: number | null;
  totalCases: number;
};

function inWindow(iso: string | null | undefined, start: number, end: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= start && t <= end;
}

// Aggregates a flat row list for one logical group (a single request type, or the pooled
// "all categories" set). The closed-case metrics filter to case_status='Closed' AND
// closed_dt-in-window; opened/closed counts use the full row set.
function aggregateGroup(
  rows: RawRow[],
  windowStart: number,
  windowEnd: number
): RequestTypeWindowData {
  const daysByNeighborhood = new Map<string, number[]>();
  const ontimeByNeighborhood = new Map<
    string,
    { ontime: number; total: number }
  >();
  const openedByNeighborhood = new Map<string, number>();
  const closedByNeighborhood = new Map<string, number>();
  const allDays: number[] = [];
  let closedTotal = 0;

  for (const row of rows) {
    const n = row.neighborhood?.trim();
    if (!n) continue;

    const openedHere = inWindow(row.open_dt, windowStart, windowEnd);
    const closedHere = inWindow(row.closed_dt, windowStart, windowEnd);
    if (openedHere) openedByNeighborhood.set(n, (openedByNeighborhood.get(n) ?? 0) + 1);
    if (closedHere) closedByNeighborhood.set(n, (closedByNeighborhood.get(n) ?? 0) + 1);

    // Closed-case metrics: same shape as the pre-issue-22 query
    // (case_status='Closed' AND closed_dt in window).
    const isClosedInWindow = row.case_status === "Closed" && closedHere;
    if (!isClosedInWindow) continue;
    closedTotal++;

    if (!ontimeByNeighborhood.has(n))
      ontimeByNeighborhood.set(n, { ontime: 0, total: 0 });
    const ot = ontimeByNeighborhood.get(n)!;
    ot.total++;
    if (row.on_time === "ONTIME") ot.ontime++;

    if (!row.closed_dt || !row.open_dt) continue;
    const days =
      (new Date(row.closed_dt).getTime() - new Date(row.open_dt).getTime()) /
      86400000;
    if (days < 0) continue;

    if (!daysByNeighborhood.has(n)) daysByNeighborhood.set(n, []);
    daysByNeighborhood.get(n)!.push(days);
    allDays.push(days);
  }

  // Build the union of all neighborhoods that touched this group, even those with
  // only opens-in-window (no closed cases) — the BacklogFlowChart needs them.
  const allNames = new Set<string>([
    ...daysByNeighborhood.keys(),
    ...ontimeByNeighborhood.keys(),
    ...openedByNeighborhood.keys(),
    ...closedByNeighborhood.keys(),
  ]);

  const neighborhoods = new Map<string, NeighborhoodWindowData>();
  for (const name of allNames) {
    const days = daysByNeighborhood.get(name) ?? [];
    const ot = ontimeByNeighborhood.get(name);
    neighborhoods.set(name, {
      medianDays: days.length ? median(days) : null,
      onTimeRate: ot && ot.total > 0 ? ot.ontime / ot.total : 0,
      count: ot?.total ?? 0,
      openedCount: openedByNeighborhood.get(name) ?? 0,
      closedCount: closedByNeighborhood.get(name) ?? 0,
    });
  }

  const withDays = Array.from(neighborhoods.values())
    .map((v) => v.medianDays)
    .filter((d): d is number => d !== null);
  withDays.sort((a, b) => b - a);
  const worst = withDays[0] ?? null;
  const best = withDays[withDays.length - 1] ?? null;
  const equityGap =
    worst !== null && best !== null && best > 0 ? worst / best : null;

  return {
    neighborhoods,
    cityMedian: median(allDays),
    equityGap,
    totalCases: closedTotal,
  };
}

// Aggregates raw rows into per-type per-neighborhood metrics, plus a pooled
// "all categories" entry keyed under ALL_CATEGORIES.
function computeWindow(
  rows: RawRow[],
  windowStart: number,
  windowEnd: number
): Map<string, RequestTypeWindowData> {
  const byType = new Map<string, RawRow[]>();
  for (const row of rows) {
    if (!row.neighborhood?.trim()) continue;
    const type = row.reason ?? "Unknown";
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(row);
  }

  const result = new Map<string, RequestTypeWindowData>();
  for (const [requestType, typeRows] of byType) {
    result.set(requestType, aggregateGroup(typeRows, windowStart, windowEnd));
  }
  result.set(ALL_CATEGORIES, aggregateGroup(rows, windowStart, windowEnd));
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
      .map(([name, data]) => ({
        neighborhood: name,
        medianDays: data.medianDays ?? 0,
        onTimeRate: data.onTimeRate,
        count: data.count,
        openedCount: data.openedCount,
        closedCount: data.closedCount,
      }))
      .sort((a, b) => b.medianDays - a.medianDays);

    results.push({
      requestType,
      equityGap: curr.equityGap,
      cityMedian: curr.cityMedian,
      totalCases: curr.totalCases,
      neighborhoods,
      yoyEquityGap: priorType?.equityGap ?? null,
    });
  }

  // Pull the pooled "All categories" entry to the front; sort the rest by volume.
  const allIdx = results.findIndex((r) => r.requestType === ALL_CATEGORIES);
  const all = allIdx >= 0 ? results.splice(allIdx, 1)[0] : null;
  results.sort((a, b) => b.totalCases - a.totalCases);
  return all ? [all, ...results] : results;
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

    const currentWindow = computeWindow(
      currentRows,
      windowStart.getTime(),
      windowEnd.getTime()
    );
    const priorWindow = computeWindow(
      priorRows,
      priorStart.getTime(),
      priorEnd.getTime()
    );
    const requestTypes = mergeWindows(currentWindow, priorWindow);

    // The "featured" type is the most common single category — the one the editorial
    // lede should fall back to if "All categories" isn't suitable. Skip the pooled entry.
    const featured =
      requestTypes.find((r) => r.requestType !== ALL_CATEGORIES) ?? null;

    const payload: TrackerData = {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      featured,
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
