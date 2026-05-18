import type { NeonQueryFunction } from "@neondatabase/serverless";

// ── Upsert raw page ──────────────────────────────────────────────────────────

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

// ── Raw page reads ───────────────────────────────────────────────────────────

export interface RawPage {
  id: number;
  company: string;
  source_url: string;
  raw_content: string;
}

export async function getPendingRawPages(
  sql: NeonQueryFunction<false, false>
): Promise<RawPage[]> {
  const rows = await sql`
    SELECT id, company, source_url, raw_content
    FROM vf_raw_pages
    WHERE status = 'pending'
    ORDER BY scraped_at ASC
  `;
  return rows as RawPage[];
}

// ── Feature launches ─────────────────────────────────────────────────────────

export interface FeatureLaunchData {
  rawPageId: number;
  company: string;
  productName: string;
  description: string;
  releaseDate: string | null;
  sourceUrl: string;
}

export async function insertFeatureLaunch(
  sql: NeonQueryFunction<false, false>,
  data: FeatureLaunchData
): Promise<void> {
  await sql`
    INSERT INTO vf_feature_launches
      (raw_page_id, company, product_name, description, release_date, source_url)
    VALUES
      (${data.rawPageId}, ${data.company}, ${data.productName},
       ${data.description}, ${data.releaseDate}, ${data.sourceUrl})
  `;
}

// ── Status updates ───────────────────────────────────────────────────────────

export async function markExtracted(
  sql: NeonQueryFunction<false, false>,
  id: number
): Promise<void> {
  await sql`
    UPDATE vf_raw_pages SET status = 'extracted', error_message = NULL WHERE id = ${id}
  `;
}

export async function markFailed(
  sql: NeonQueryFunction<false, false>,
  id: number,
  errorMessage: string
): Promise<void> {
  await sql`
    UPDATE vf_raw_pages SET status = 'failed', error_message = ${errorMessage} WHERE id = ${id}
  `;
}

export async function resetFailedToPending(
  sql: NeonQueryFunction<false, false>
): Promise<number> {
  const rows = await sql`
    UPDATE vf_raw_pages SET status = 'pending', error_message = NULL
    WHERE status = 'failed'
    RETURNING id
  `;
  return rows.length;
}
