// route.ts — Semantic search over vendor feed embeddings (issue #166).
// Queries Upstash Vector and returns deduplicated source_url matches.

import { Index } from "@upstash/vector";
import type { NextRequest } from "next/server";

type ChunkMetadata = {
  raw_page_id: string;
  company: string;
  source_url: string;
  scraped_at: string;
  chunk_index: number;
};

export type SearchMatch = {
  rawPageId: string;
  sourceUrl: string;
  company: string;
  chunk: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return Response.json({ matches: [] });

  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_READONLY_TOKEN;
  if (!url || !token) {
    return Response.json({ error: "Vector index not configured" }, { status: 503 });
  }

  try {
    const index = new Index<ChunkMetadata>({ url, token });
    const results = await index.query({
      data: q,
      topK: 20,
      includeMetadata: true,
      includeData: true,
    });

    // Deduplicate by source_url — multiple chunks from the same page may match
    const seen = new Set<string>();
    const matches: SearchMatch[] = [];

    for (const r of results) {
      if (!r.metadata) continue;
      const sourceUrl = r.metadata.source_url;
      if (seen.has(sourceUrl)) continue;
      seen.add(sourceUrl);
      matches.push({
        rawPageId: String(r.metadata.raw_page_id),
        sourceUrl,
        company: r.metadata.company,
        chunk: typeof r.data === "string" ? r.data : "",
      });
    }

    return Response.json({ matches });
  } catch (err) {
    console.error("[vendor-feed/search]", err);
    return Response.json({ error: "Search failed" }, { status: 502 });
  }
}
