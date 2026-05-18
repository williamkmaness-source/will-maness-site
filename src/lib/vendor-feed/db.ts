import type { NeonQueryFunction } from "@neondatabase/serverless";

export type UpsertAction = "inserted" | "updated" | "skipped";

export interface RawPageData {
  company: string;
  sourceUrl: string;
  contentHash: string;
  rawContent: string;
}

export async function upsertRawPage(
  sql: NeonQueryFunction<false, false>,
  data: RawPageData
): Promise<{ action: UpsertAction; id?: number }> {
  // ON CONFLICT (source_url): update only if hash changed.
  // If hash unchanged the WHERE clause suppresses the update and RETURNING returns nothing → skipped.
  const rows = await sql`
    INSERT INTO vf_raw_pages (company, source_url, content_hash, raw_content, status)
    VALUES (${data.company}, ${data.sourceUrl}, ${data.contentHash}, ${data.rawContent}, 'pending')
    ON CONFLICT (source_url) DO UPDATE
      SET content_hash  = EXCLUDED.content_hash,
          raw_content   = EXCLUDED.raw_content,
          status        = 'pending',
          error_message = NULL,
          scraped_at    = now()
      WHERE vf_raw_pages.content_hash != EXCLUDED.content_hash
    RETURNING id, (xmax = 0) AS inserted
  `;

  if (rows.length === 0) return { action: "skipped" };
  const row = rows[0] as { id: number; inserted: boolean };
  return { action: row.inserted ? "inserted" : "updated", id: row.id };
}
