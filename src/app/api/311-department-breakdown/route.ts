import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const CACHE_HEADER = "s-maxage=86400, stale-while-revalidate";
const WINDOW_DAYS = 14;
const TOP_N = 10;

export type ReasonCount = {
  reason: string;
  opened: number;
  closed: number;
};

export type DepartmentBreakdownPayload = {
  department: string;
  reasons: ReasonCount[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");

  if (!department) {
    return Response.json({ error: "department query param required" }, { status: 400 });
  }

  const connectionString =
    process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const sql = neon(connectionString);

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const rows = await sql`
      SELECT
        ce.request_type AS reason,
        SUM(CASE WHEN ce.open_date >= ${cutoffStr}::date THEN 1 ELSE 0 END)::int AS opened,
        SUM(CASE WHEN ce.close_date >= ${cutoffStr}::date THEN 1 ELSE 0 END)::int AS closed
      FROM case_events ce
      JOIN request_type_meta rtm ON rtm.request_type = ce.request_type
      WHERE rtm.department = ${department}
        AND rtm.include_in_dashboard = true
        AND (
          ce.open_date  >= ${cutoffStr}::date
          OR ce.close_date >= ${cutoffStr}::date
        )
      GROUP BY ce.request_type
      ORDER BY (
        SUM(CASE WHEN ce.open_date  >= ${cutoffStr}::date THEN 1 ELSE 0 END) +
        SUM(CASE WHEN ce.close_date >= ${cutoffStr}::date THEN 1 ELSE 0 END)
      ) DESC
      LIMIT ${TOP_N}
    `;

    const reasons: ReasonCount[] = rows.map((row) => ({
      reason: String(row.reason),
      opened: Number(row.opened),
      closed: Number(row.closed),
    }));

    const payload: DepartmentBreakdownPayload = { department, reasons };

    return Response.json(payload, {
      headers: { "Cache-Control": CACHE_HEADER },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("311-department-breakdown API:", err);
    return Response.json({ error: message }, { status: 502 });
  }
}
