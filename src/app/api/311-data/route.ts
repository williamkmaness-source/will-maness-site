// route.ts — Equity Tracker API route.
// Attempts to serve the latest snapshot from Postgres; falls back to live CKAN fetch.
// Fetches two 30-day windows in parallel (current + prior year) for YoY comparison.
// Note: Analyze Boston migrated from Socrata to CKAN/OpenGov; data is split per-year by
// case-open year. We pull every case where open_dt OR closed_dt falls in the window,
// which feeds both the closed-case equity metrics and the BacklogFlowChart's opened/closed
// counts. Closed-status filtering happens in the aggregator, not the SQL.
// Response is CDN-cached for 24 hours.

import { neon } from "@neondatabase/serverless";
import {
  ALL_CATEGORIES,
  type NeighborhoodStat,
  type RequestTypeMetrics,
  type TrackerData,
} from "@/components/projects/boston-civic-data/types";
import {
  fetchWindow,
  computeWindow,
  mergeWindows,
} from "@/lib/boston-311";

const CACHE_HEADER = "s-maxage=86400, stale-while-revalidate";

// Reads the latest snapshot from Postgres. Returns null if the table is empty.
// Uses the pooled connection string (fine for route handlers).
async function readFromPostgres(): Promise<TrackerData | null> {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) return null;

  const sql = neon(connectionString);

  const rows = await sql`
    SELECT * FROM snapshots
    WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM snapshots)
  `;

  if (rows.length === 0) return null;

  // Group rows by request_type to reconstruct RequestTypeMetrics[].
  const byType = new Map<string, typeof rows>();
  for (const row of rows) {
    const rt = row.request_type as string;
    if (!byType.has(rt)) byType.set(rt, []);
    byType.get(rt)!.push(row);
  }

  // Pull window bounds from any row.
  const anyRow = rows[0];
  const windowStart = new Date(anyRow.window_start as string).toISOString();
  const windowEnd = new Date(anyRow.window_end as string).toISOString();

  const requestTypes: RequestTypeMetrics[] = [];

  for (const [requestType, typeRows] of byType) {
    const neighborhoods: NeighborhoodStat[] = typeRows.map((r) => ({
      neighborhood: r.neighborhood as string,
      medianDays: Number(r.median_days ?? 0),
      onTimeRate: Number(r.on_time_rate ?? 0),
      count: Number(r.case_count ?? 0),
      openedCount: Number(r.opened_count ?? 0),
      closedCount: Number(r.closed_count ?? 0),
    }));

    // Sort neighborhoods by medianDays desc — matches mergeWindows output shape.
    neighborhoods.sort((a, b) => b.medianDays - a.medianDays);

    // Type-level fields are identical across all neighborhood rows; read from first.
    const first = typeRows[0];
    requestTypes.push({
      requestType,
      equityGap: first.equity_gap != null ? Number(first.equity_gap) : null,
      cityMedian: first.city_median != null ? Number(first.city_median) : null,
      totalCases: Number(first.total_cases ?? 0),
      neighborhoods,
      yoyEquityGap:
        first.yoy_equity_gap != null ? Number(first.yoy_equity_gap) : null,
    });
  }

  // Reconstruct sort order: ALL_CATEGORIES first, then by totalCases desc.
  const allIdx = requestTypes.findIndex((r) => r.requestType === ALL_CATEGORIES);
  const all = allIdx >= 0 ? requestTypes.splice(allIdx, 1)[0] : null;
  requestTypes.sort((a, b) => b.totalCases - a.totalCases);
  const sorted = all ? [all, ...requestTypes] : requestTypes;

  const featured =
    sorted.find((r) => r.requestType !== ALL_CATEGORIES) ?? null;

  return {
    windowStart,
    windowEnd,
    featured,
    requestTypes: sorted,
  };
}

export async function GET() {
  // Attempt Postgres read first.
  try {
    const cached = await readFromPostgres();
    if (cached) {
      return Response.json(cached, {
        headers: { "Cache-Control": CACHE_HEADER },
      });
    }
    // Empty table — fall through to live CKAN fetch.
  } catch (err) {
    // Postgres unavailable — log and fall through to CKAN.
    console.warn("311 route: Postgres read failed, falling back to CKAN:", err);
  }

  // Live CKAN fetch (fallback path).
  const windowEnd = new Date();
  const windowStart = new Date(
    windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000
  );
  const priorEnd = new Date(windowEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
  const priorStart = new Date(
    windowStart.getTime() - 365 * 24 * 60 * 60 * 1000
  );

  try {
    const [currentResult, priorResult] = await Promise.all([
      fetchWindow(windowStart, windowEnd),
      fetchWindow(priorStart, priorEnd),
    ]);

    const currentWindow = computeWindow(
      currentResult.rows,
      windowStart.getTime(),
      windowEnd.getTime()
    );
    const priorWindow = computeWindow(
      priorResult.rows,
      priorStart.getTime(),
      priorEnd.getTime()
    );
    const requestTypes = mergeWindows(currentWindow, priorWindow);

    // The "featured" type is the most common single category — the one the editorial
    // lede should fall back to if "All categories" isn't suitable. Skip the pooled entry.
    const featured =
      requestTypes.find((r) => r.requestType !== ALL_CATEGORIES) ?? null;

    const degraded = currentResult.degraded || priorResult.degraded;

    const payload: TrackerData & { degraded?: boolean } = {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      featured,
      requestTypes,
      ...(degraded && { degraded: true }),
    };

    return Response.json(payload, {
      headers: {
        "Cache-Control": CACHE_HEADER,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
