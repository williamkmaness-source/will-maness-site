// PipelineStatusService — reads pipeline health from Neon Postgres.
//
// pipeline_runs rows drive the 311 and chess cards.
// vf_raw_pages aggregation drives the vendor-feed card.

import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { PipelineStatus } from "@/components/projects/pipeline-dashboard/types";

type RunRow = {
  pipeline: string;
  status: string;
  last_success_at: string | null;
  last_attempt_at: string | null;
  record_count: number | null;
  error: string | null;
};

type VfRow = {
  extracted: string;
  pending: string;
  failed: string;
  last_success_at: string | null;
  last_attempt_at: string | null;
};

function unknown(pipeline: PipelineStatus["pipeline"]): PipelineStatus {
  return {
    pipeline,
    status: "unknown",
    lastSuccessAt: null,
    lastAttemptAt: null,
    recordCount: null,
    error: null,
  };
}

export function buildRunStatus(row: RunRow): PipelineStatus {
  return {
    pipeline: row.pipeline as PipelineStatus["pipeline"],
    status: (row.status as PipelineStatus["status"]) ?? "unknown",
    lastSuccessAt: row.last_success_at,
    lastAttemptAt: row.last_attempt_at,
    recordCount: row.record_count,
    error: row.error,
  };
}

export function buildVendorFeedStatus(row: VfRow | null): PipelineStatus {
  if (!row) return unknown("vendor-feed");

  const extracted = Number(row.extracted);
  const failed = Number(row.failed);

  let status: PipelineStatus["status"] = "unknown";
  if (extracted > 0) status = "success";
  else if (failed > 0) status = "failed";

  return {
    pipeline: "vendor-feed",
    status,
    lastSuccessAt: row.last_success_at,
    lastAttemptAt: row.last_attempt_at,
    recordCount: extracted > 0 ? extracted : null,
    error: failed > 0 ? `${failed} page${failed === 1 ? "" : "s"} failed` : null,
  };
}

export async function getPipelineStatuses(
  sql: NeonQueryFunction<false, false>
): Promise<PipelineStatus[]> {
  const [runRows, vfRows] = await Promise.all([
    sql`
      SELECT DISTINCT ON (pipeline)
        pipeline, status, last_success_at, last_attempt_at, record_count, error
      FROM pipeline_runs
      WHERE pipeline IN ('311', 'chess')
      ORDER BY pipeline, last_attempt_at DESC
    `,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'extracted')::text AS extracted,
        COUNT(*) FILTER (WHERE status = 'pending')::text   AS pending,
        COUNT(*) FILTER (WHERE status = 'failed')::text    AS failed,
        MAX(scraped_at) FILTER (WHERE status = 'extracted') AS last_success_at,
        MAX(scraped_at) AS last_attempt_at
      FROM vf_raw_pages
    `,
  ]);

  const byPipeline = new Map<string, PipelineStatus>();
  for (const row of runRows as RunRow[]) {
    byPipeline.set(row.pipeline, buildRunStatus(row));
  }

  return [
    byPipeline.get("311") ?? unknown("311"),
    byPipeline.get("chess") ?? unknown("chess"),
    buildVendorFeedStatus((vfRows as VfRow[])[0] ?? null),
  ];
}
