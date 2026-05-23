// route.ts — EmberBrief data API (issue #93).
// Returns the most recent fire clusters and county conditions for Shasta County.

import type { NextRequest } from "next/server";
import { getEmberData, getSqlClient } from "@/lib/ember/ember-queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest): Promise<Response> {
  let sql;
  try {
    sql = getSqlClient();
  } catch {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const data = await getEmberData(sql);
    return Response.json(data);
  } catch (err) {
    console.error("[ember-data]", err);
    return Response.json({ error: "Failed to fetch ember data" }, { status: 502 });
  }
}
