import { neon } from "@neondatabase/serverless";
import { flagDepartment, type WeeklyMetrics } from "@/lib/boston-311-flagging";

export const dynamic = "force-dynamic";

const CACHE_HEADER = "s-maxage=86400, stale-while-revalidate";
const WEEKS_WINDOW = 12;

export type DepartmentResult = {
  department: string;
  weeks: WeeklyMetrics[];
  status: "green" | "yellow" | "red";
  tooltip: string;
};

export type DepartmentsPayload = {
  departments: DepartmentResult[];
  flaggedCount: number;
  totalCount: number;
  lastUpdated: string | null;
};

export async function GET() {
  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const sql = neon(connectionString);

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WEEKS_WINDOW * 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const [metricsRows, pipelineRows] = await Promise.all([
      sql`
        SELECT week, department, opened, closed, median_days
        FROM department_weekly_metrics
        WHERE week >= ${cutoffStr}::date
        ORDER BY department, week
      `,
      sql`
        SELECT last_success_at FROM pipeline_runs WHERE pipeline = '311' LIMIT 1
      `,
    ]);

    const byDept = new Map<string, WeeklyMetrics[]>();
    for (const row of metricsRows) {
      const dept = String(row.department);
      if (!byDept.has(dept)) byDept.set(dept, []);
      const raw = String(row.week);
      const weekStr = raw.length >= 10 && raw[4] === "-"
        ? raw.slice(0, 10)
        : new Date(raw).toISOString().slice(0, 10);
      byDept.get(dept)!.push({
        week: weekStr,
        opened: Number(row.opened),
        closed: Number(row.closed),
        medianDays: row.median_days != null ? Number(row.median_days) : 0,
      });
    }

    const departments: DepartmentResult[] = [];
    for (const [department, weeks] of byDept) {
      const { status, tooltip } = flagDepartment(weeks);
      departments.push({ department, weeks, status, tooltip });
    }

    const statusOrder = { red: 0, yellow: 1, green: 2 };
    departments.sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status]
    );

    const flaggedCount = departments.filter((d) => d.status !== "green").length;
    const lastUpdated =
      pipelineRows[0]?.last_success_at != null
        ? String(pipelineRows[0].last_success_at)
        : null;

    const payload: DepartmentsPayload = {
      departments,
      flaggedCount,
      totalCount: departments.length,
      lastUpdated,
    };

    return Response.json(payload, {
      headers: { "Cache-Control": CACHE_HEADER },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("311-departments API:", err);
    return Response.json({ error: message }, { status: 502 });
  }
}
