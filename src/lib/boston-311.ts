// boston-311.ts — Shared fetch and aggregate logic for the 311 Equity Tracker.
// Extracted from the API route so the nightly pipeline script can reuse it.
// fetchFromResource retries up to 3 times with exponential backoff (2s, 4s, 8s).

import {
  ALL_CATEGORIES,
  type NeighborhoodStat,
  type RequestTypeMetrics,
} from "@/components/projects/boston-civic-data/types";

export { ALL_CATEGORIES };

export const CKAN_SQL_URL =
  "https://data.boston.gov/api/3/action/datastore_search_sql";
export const PAGE_SIZE = 50000;
const MAX_RETRIES = 3;
// Per-page fetch deadline — a single stuck CKAN call won't consume the whole Vercel timeout.
const PAGE_TIMEOUT_MS = 20_000;

// Per-year resource IDs from Analyze Boston. Indexed by case-open year.
export const YEAR_RESOURCES: ReadonlyArray<readonly [number, string]> = [
  [2024, "dff4d804-5031-443a-8409-8344efd0e5c8"],
  [2025, "9d7c2214-4709-478a-a2e8-fb2020a5bb94"],
  [2026, "1a0b420d-99f1-4887-9851-990b2a5a6e17"],
];

export type RawRow = {
  neighborhood?: string | null;
  reason?: string | null;
  case_status?: string | null;
  open_dt?: string | null;
  closed_dt?: string | null;
  on_time?: string | null;
};

export type CKANResponse = {
  success: boolean;
  result?: { records: RawRow[] };
  error?: { message?: string };
};

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function inWindow(
  iso: string | null | undefined,
  start: number,
  end: number
): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= start && t <= end;
}

// startDate/endDate must be ISO YYYY-MM-DD strings — we derive them from Date.toISOString
// in the caller, which guarantees no characters that would break the SQL string. Do not pass
// untrusted input here without a stricter validator (CKAN does not parameterize this endpoint).
// Retries up to MAX_RETRIES times with exponential backoff (2s, 4s, 8s) on transient failures.
export async function fetchFromResource(
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

    let json: CKANResponse | undefined;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        clearTimeout(timer);

        // 4xx errors are not retried — they indicate a bad query or missing resource.
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`CKAN API responded ${res.status}: ${res.statusText}`);
        }
        if (!res.ok) {
          throw new Error(`CKAN API responded ${res.status}: ${res.statusText}`);
        }

        json = (await res.json()) as CKANResponse;
        lastError = undefined;
        break;
      } catch (err) {
        clearTimeout(timer);
        const e = err instanceof Error ? err : new Error(String(err));
        // Don't retry on 4xx errors.
        if (e.message.startsWith("CKAN API responded 4")) throw e;
        lastError = e;

        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 2s, 4s, 8s
          await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
        }
      }
    }

    if (!json) {
      throw new Error(
        `fetchFromResource: all ${MAX_RETRIES} attempts failed for resource ${resourceId}` +
          (lastError ? ` — ${lastError.message}` : "")
      );
    }

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

export type FetchWindowResult = {
  rows: RawRow[];
  degraded: boolean;
};

// Fetches only the year resources whose year overlaps the query window, avoiding
// unnecessary fetches (e.g. a May 2026 window never touches 2024 data).
// Partial failures (one resource down) return the surviving rows with degraded: true.
// Total failure re-throws.
export async function fetchWindow(start: Date, end: Date): Promise<FetchWindowResult> {
  const startDate = toDateStr(start);
  const endDate = toDateStr(end);

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  // Include a resource if its year is within [startYear - 1, endYear].
  // The -1 handles cases where a case opened in late December of the prior year
  // but closed within the window.
  const relevant = YEAR_RESOURCES.filter(
    ([year]) => year >= startYear - 1 && year <= endYear
  );

  const settled = await Promise.allSettled(
    relevant.map(([, resourceId]) =>
      fetchFromResource(resourceId, startDate, endDate)
    )
  );

  const rows: RawRow[] = [];
  let degraded = false;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      rows.push(...result.value);
    } else {
      degraded = true;
      console.error("311 data: resource fetch failed:", result.reason);
    }
  }

  if (rows.length === 0 && degraded) {
    throw new Error("All CKAN resources failed; cannot produce a response.");
  }

  return { rows, degraded };
}

// Per-neighborhood aggregated data for a single window.
export type NeighborhoodWindowData = {
  medianDays: number | null;
  onTimeRate: number;
  count: number;
  openedCount: number;
  closedCount: number;
};

// Per-request-type aggregated data for a single window.
export type RequestTypeWindowData = {
  neighborhoods: Map<string, NeighborhoodWindowData>;
  cityMedian: number | null;
  equityGap: number | null;
  totalCases: number;
};

// Aggregates a flat row list for one logical group (a single request type, or the pooled
// "all categories" set). The closed-case metrics filter to case_status='Closed' AND
// closed_dt-in-window; opened/closed counts use the full row set.
export function aggregateGroup(
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
export function computeWindow(
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
export function mergeWindows(
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
