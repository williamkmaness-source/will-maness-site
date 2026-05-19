// route.ts — Equity Tracker API route.
// Primary path: compute metrics live from case_events using PERCENTILE_CONT,
// joined with request_type_meta for department/slaTarget fields.
// Fallback: read pre-aggregated snapshots table (no department/slaTarget).
// Returns 503 if both stores are empty.
// Response is CDN-cached for 24 hours.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import {
  ALL_CATEGORIES,
  type NeighborhoodStat,
  type RequestTypeMetrics,
  type TrackerData,
} from "@/components/projects/boston-civic-data/types";
import { toDateStr } from "@/lib/boston-311";

const CACHE_HEADER = "s-maxage=86400, stale-while-revalidate";

type SqlFn = NeonQueryFunction<false, false>;

// DB row shapes used for explicit casts on query results.
type NbRow = {
  neighborhood: string;
  request_type: string;
  median_days: string | null;
  on_time_rate: string | null;
  case_count: string;
  opened_count: string;
  closed_count: string;
  department?: string | null;
  sla_days?: string | null;
};
type CityRow = { request_type: string; city_median: string | null; total_cases: string };
type AllCityRow = { city_median: string | null; total_cases: string };
type SnapshotRow = {
  neighborhood: string;
  request_type: string;
  median_days: string | null;
  on_time_rate: string | null;
  case_count: string | null;
  opened_count: string | null;
  closed_count: string | null;
  city_median: string | null;
  equity_gap: string | null;
  total_cases: string | null;
  yoy_equity_gap: string | null;
};

export function computeEquityGap(neighborhoods: NeighborhoodStat[]): number | null {
  const withDays = neighborhoods
    .map((n) => n.medianDays)
    .filter((d) => d > 0)
    .sort((a, b) => b - a);
  const worst = withDays[0] ?? null;
  const best = withDays[withDays.length - 1] ?? null;
  return worst !== null && best !== null && best > 0 ? worst / best : null;
}

// Queries case_events (with PERCENTILE_CONT) and request_type_meta for a
// 30-day window. Returns null if case_events is empty.
async function readFromCaseEvents(
  sql: SqlFn,
  startDate: string,
  endDate: string
): Promise<RequestTypeMetrics[] | null> {
  const probe = await sql`SELECT 1 FROM case_events LIMIT 1`;
  if (probe.length === 0) return null;

  // All four data queries can run in parallel once we know the table has rows.
  const [nbRows, cityRows, allNbRows, allCityArr] = (await Promise.all([
    // Per-neighborhood, per-request-type metrics + request_type_meta join
    sql`
      SELECT
        ce.neighborhood,
        ce.request_type,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ce.days_to_close)          AS median_days,
        AVG(ce.on_time::int)                                                    AS on_time_rate,
        COUNT(*) FILTER (WHERE ce.close_date BETWEEN ${startDate}::date AND ${endDate}::date) AS case_count,
        COUNT(*) FILTER (WHERE ce.open_date  BETWEEN ${startDate}::date AND ${endDate}::date) AS opened_count,
        COUNT(*) FILTER (WHERE ce.close_date BETWEEN ${startDate}::date AND ${endDate}::date) AS closed_count,
        MAX(rtm.department)                                                      AS department,
        MAX(rtm.sla_days)                                                        AS sla_days
      FROM case_events ce
      LEFT JOIN request_type_meta rtm ON rtm.request_type = ce.request_type
      WHERE (ce.open_date  BETWEEN ${startDate}::date AND ${endDate}::date
          OR ce.close_date BETWEEN ${startDate}::date AND ${endDate}::date)
      GROUP BY ce.neighborhood, ce.request_type
    `,
    // City-level per-request-type (for city median + total cases)
    sql`
      SELECT
        request_type,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_close) AS city_median,
        COUNT(*) FILTER (WHERE close_date BETWEEN ${startDate}::date AND ${endDate}::date) AS total_cases
      FROM case_events
      WHERE (open_date  BETWEEN ${startDate}::date AND ${endDate}::date
          OR close_date BETWEEN ${startDate}::date AND ${endDate}::date)
      GROUP BY request_type
    `,
    // Per-neighborhood across ALL request types (for ALL_CATEGORIES)
    sql`
      SELECT
        neighborhood,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_close) AS median_days,
        AVG(on_time::int)                                            AS on_time_rate,
        COUNT(*) FILTER (WHERE close_date BETWEEN ${startDate}::date AND ${endDate}::date) AS case_count,
        COUNT(*) FILTER (WHERE open_date  BETWEEN ${startDate}::date AND ${endDate}::date) AS opened_count,
        COUNT(*) FILTER (WHERE close_date BETWEEN ${startDate}::date AND ${endDate}::date) AS closed_count
      FROM case_events
      WHERE (open_date  BETWEEN ${startDate}::date AND ${endDate}::date
          OR close_date BETWEEN ${startDate}::date AND ${endDate}::date)
      GROUP BY neighborhood
    `,
    // City-level all-categories
    sql`
      SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_close) AS city_median,
        COUNT(*) FILTER (WHERE close_date BETWEEN ${startDate}::date AND ${endDate}::date) AS total_cases
      FROM case_events
      WHERE (open_date  BETWEEN ${startDate}::date AND ${endDate}::date
          OR close_date BETWEEN ${startDate}::date AND ${endDate}::date)
    `,
  ])) as [NbRow[], CityRow[], NbRow[], AllCityRow[]];

  const allCityRow = allCityArr[0];

  // City-level lookup by request type
  const cityByType = new Map<
    string,
    { cityMedian: number | null; totalCases: number }
  >();
  for (const r of cityRows) {
    cityByType.set(r.request_type as string, {
      cityMedian: r.city_median != null ? Number(r.city_median) : null,
      totalCases: Number(r.total_cases),
    });
  }

  // Group neighborhood rows by request type
  const nbByType = new Map<string, NbRow[]>();
  for (const r of nbRows) {
    const rt = r.request_type as string;
    if (!nbByType.has(rt)) nbByType.set(rt, []);
    nbByType.get(rt)!.push(r);
  }

  const requestTypes: RequestTypeMetrics[] = [];

  for (const [requestType, rows] of nbByType) {
    const neighborhoods: NeighborhoodStat[] = rows
      .map((r) => ({
        neighborhood: r.neighborhood as string,
        medianDays: Number(r.median_days ?? 0),
        onTimeRate: Number(r.on_time_rate ?? 0),
        count: Number(r.case_count),
        openedCount: Number(r.opened_count),
        closedCount: Number(r.closed_count),
      }))
      .sort((a, b) => b.medianDays - a.medianDays);

    const city = cityByType.get(requestType);
    const first = rows[0];

    requestTypes.push({
      requestType,
      department: (first.department as string | null) ?? null,
      slaTarget: first.sla_days != null ? Number(first.sla_days) : null,
      equityGap: computeEquityGap(neighborhoods),
      cityMedian: city?.cityMedian ?? null,
      totalCases: city?.totalCases ?? 0,
      neighborhoods,
      yoyEquityGap: null,
    });
  }

  // Build ALL_CATEGORIES entry
  const allNeighborhoods: NeighborhoodStat[] = allNbRows
    .map((r) => ({
      neighborhood: r.neighborhood as string,
      medianDays: Number(r.median_days ?? 0),
      onTimeRate: Number(r.on_time_rate ?? 0),
      count: Number(r.case_count),
      openedCount: Number(r.opened_count),
      closedCount: Number(r.closed_count),
    }))
    .sort((a, b) => b.medianDays - a.medianDays);

  const allEntry: RequestTypeMetrics = {
    requestType: ALL_CATEGORIES,
    department: null,
    slaTarget: null,
    equityGap: computeEquityGap(allNeighborhoods),
    cityMedian:
      allCityRow?.city_median != null ? Number(allCityRow.city_median) : null,
    totalCases:
      allCityRow?.total_cases != null ? Number(allCityRow.total_cases) : 0,
    neighborhoods: allNeighborhoods,
    yoyEquityGap: null,
  };

  requestTypes.sort((a, b) => b.totalCases - a.totalCases);
  return [allEntry, ...requestTypes];
}

// Fallback: read from legacy snapshots table. department/slaTarget not available.
async function readFromSnapshots(
  sql: SqlFn
): Promise<RequestTypeMetrics[] | null> {
  const rows = (await sql`
    SELECT * FROM snapshots
    WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM snapshots)
  `) as SnapshotRow[];

  if (rows.length === 0) return null;

  const byType = new Map<string, SnapshotRow[]>();
  for (const row of rows) {
    const rt = row.request_type as string;
    if (!byType.has(rt)) byType.set(rt, []);
    byType.get(rt)!.push(row);
  }

  const requestTypes: RequestTypeMetrics[] = [];

  for (const [requestType, typeRows] of byType) {
    const neighborhoods: NeighborhoodStat[] = typeRows
      .map((r) => ({
        neighborhood: r.neighborhood as string,
        medianDays: Number(r.median_days ?? 0),
        onTimeRate: Number(r.on_time_rate ?? 0),
        count: Number(r.case_count ?? 0),
        openedCount: Number(r.opened_count ?? 0),
        closedCount: Number(r.closed_count ?? 0),
      }))
      .sort((a, b) => b.medianDays - a.medianDays);

    const first = typeRows[0];
    requestTypes.push({
      requestType,
      department: null,
      slaTarget: null,
      equityGap: first.equity_gap != null ? Number(first.equity_gap) : null,
      cityMedian: first.city_median != null ? Number(first.city_median) : null,
      totalCases: Number(first.total_cases ?? 0),
      neighborhoods,
      yoyEquityGap:
        first.yoy_equity_gap != null ? Number(first.yoy_equity_gap) : null,
    });
  }

  const allIdx = requestTypes.findIndex((r) => r.requestType === ALL_CATEGORIES);
  const all = allIdx >= 0 ? requestTypes.splice(allIdx, 1)[0] : null;
  requestTypes.sort((a, b) => b.totalCases - a.totalCases);
  return all ? [all, ...requestTypes] : requestTypes;
}

export async function GET() {
  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const sql = neon(connectionString);

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const priorEnd = new Date(windowEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
  const priorStart = new Date(
    windowStart.getTime() - 365 * 24 * 60 * 60 * 1000
  );

  const startDate = toDateStr(windowStart);
  const endDate = toDateStr(windowEnd);
  const priorStartDate = toDateStr(priorStart);
  const priorEndDate = toDateStr(priorEnd);

  try {
    const [currentFromEvents, prior] = await Promise.all([
      readFromCaseEvents(sql, startDate, endDate),
      readFromCaseEvents(sql, priorStartDate, priorEndDate),
    ]);

    let current = currentFromEvents;
    if (!current) {
      current = await readFromSnapshots(sql);
    }

    if (!current) {
      return Response.json(
        {
          error:
            "No pipeline data available. Check back after the first pipeline run.",
        },
        { status: 503 }
      );
    }

    if (prior) {
      const priorByType = new Map(prior.map((r) => [r.requestType, r]));
      for (const r of current) {
        r.yoyEquityGap = priorByType.get(r.requestType)?.equityGap ?? null;
      }
    }

    const featured =
      current.find((r) => r.requestType !== ALL_CATEGORIES) ?? null;

    const payload: TrackerData = {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      featured,
      requestTypes: current,
    };

    return Response.json(payload, {
      headers: { "Cache-Control": CACHE_HEADER },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("311 API:", err);
    return Response.json({ error: message }, { status: 502 });
  }
}
