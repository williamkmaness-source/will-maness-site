// route.ts — Equity Tracker API route.
// Fetches the most recent 30 days of closed 311 cases from Analyze Boston (CKAN datastore).
// Note: Analyze Boston migrated from Socrata to CKAN/OpenGov; data is split per-year by
// case-open year. The window filter is on closed_dt, so we must query every year resource
// whose cases could plausibly close in the window (a case opened in 2024 may close in 2026).
// Response is CDN-cached for 24 hours.

import type { RequestTypeMetrics, TrackerData } from "@/components/311/types";

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

async function fetchWindow(start: Date, end: Date): Promise<RawRow[]> {
  const startDate = toDateStr(start);
  const endDate = toDateStr(end);
  const allRows: RawRow[] = [];

  // Query every year resource — a case in any year's bucket may have closed inside our window.
  // The closed_dt SQL filter scopes each resource to the window; non-matching years return empty.
  for (const [, resourceId] of YEAR_RESOURCES) {
    const rows = await fetchFromResource(resourceId, startDate, endDate);
    allRows.push(...rows);
  }

  return allRows;
}

function computeMetrics(rows: RawRow[]): RequestTypeMetrics[] {
  const byType = new Map<string, RawRow[]>();
  for (const row of rows) {
    // Skip whitespace-only neighborhoods that slipped through the SQL filter.
    if (!row.neighborhood?.trim()) continue;
    const type = row.reason ?? "Unknown";
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(row);
  }

  const results: RequestTypeMetrics[] = [];

  for (const [requestType, typeRows] of byType) {
    const daysByNeighborhood = new Map<string, number[]>();
    const ontimeByNeighborhood = new Map<
      string,
      { ontime: number; total: number }
    >();
    const allDays: number[] = [];

    for (const row of typeRows) {
      const n = row.neighborhood!.trim();

      if (!ontimeByNeighborhood.has(n)) {
        ontimeByNeighborhood.set(n, { ontime: 0, total: 0 });
      }
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

    const neighborhoods = Array.from(daysByNeighborhood.entries())
      .map(([name, days]) => {
        const ot = ontimeByNeighborhood.get(name);
        return {
          neighborhood: name,
          medianDays: median(days)!,
          onTimeRate: ot ? ot.ontime / ot.total : 0,
          count: ot?.total ?? days.length,
        };
      })
      .sort((a, b) => b.medianDays - a.medianDays);

    const worst = neighborhoods[0] ?? null;
    const best = neighborhoods[neighborhoods.length - 1] ?? null;
    const equityGap =
      worst && best && best.medianDays > 0
        ? worst.medianDays / best.medianDays
        : null;

    results.push({
      requestType,
      equityGap,
      worstNeighborhood: worst?.neighborhood ?? null,
      worstMedianDays: worst?.medianDays ?? null,
      bestNeighborhood: best?.neighborhood ?? null,
      bestMedianDays: best?.medianDays ?? null,
      cityMedian: median(allDays),
      totalCases: typeRows.length,
      neighborhoods,
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

  try {
    const rows = await fetchWindow(windowStart, windowEnd);
    const requestTypes = computeMetrics(rows);

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
