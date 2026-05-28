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
  scraped_at: Date;
}

export async function getPendingRawPages(
  sql: NeonQueryFunction<false, false>
): Promise<RawPage[]> {
  const rows = await sql`
    SELECT id, company, source_url, raw_content, scraped_at
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

// ── Pricing changes ──────────────────────────────────────────────────────────

export interface PricingChangeData {
  rawPageId: number;
  company: string;
  description: string;
  direction: string | null;
  effectiveDate: string | null;
  sourceUrl: string;
}

export async function insertPricingChange(
  sql: NeonQueryFunction<false, false>,
  data: PricingChangeData
): Promise<void> {
  await sql`
    INSERT INTO vf_pricing_changes
      (raw_page_id, company, description, direction, effective_date, source_url)
    VALUES
      (${data.rawPageId}, ${data.company}, ${data.description},
       ${data.direction}, ${data.effectiveDate}, ${data.sourceUrl})
  `;
}

// ── Partnerships ─────────────────────────────────────────────────────────────

export interface PartnershipData {
  rawPageId: number;
  company: string;
  partnerCompany: string;
  integrationType: string | null;
  description: string;
  announcedDate: string | null;
  sourceUrl: string;
}

export async function insertPartnership(
  sql: NeonQueryFunction<false, false>,
  data: PartnershipData
): Promise<void> {
  await sql`
    INSERT INTO vf_partnerships
      (raw_page_id, company, partner_company, integration_type, description, announced_date, source_url)
    VALUES
      (${data.rawPageId}, ${data.company}, ${data.partnerCompany}, ${data.integrationType},
       ${data.description}, ${data.announcedDate}, ${data.sourceUrl})
  `;
}

// ── Architectural shifts ──────────────────────────────────────────────────────

export interface ArchitecturalShiftData {
  rawPageId: number;
  company: string;
  fromTechnology: string | null;
  toTechnology: string | null;
  description: string;
  announcedDate: string | null;
  sourceUrl: string;
}

export async function insertArchitecturalShift(
  sql: NeonQueryFunction<false, false>,
  data: ArchitecturalShiftData
): Promise<void> {
  await sql`
    INSERT INTO vf_architectural_shifts
      (raw_page_id, company, from_technology, to_technology, description, announced_date, source_url)
    VALUES
      (${data.rawPageId}, ${data.company}, ${data.fromTechnology}, ${data.toTechnology},
       ${data.description}, ${data.announcedDate}, ${data.sourceUrl})
  `;
}

// ── Entity cleanup ───────────────────────────────────────────────────────────

export async function deleteEntitiesForPage(
  sql: NeonQueryFunction<false, false>,
  rawPageId: number
): Promise<void> {
  await Promise.all([
    sql`DELETE FROM vf_feature_launches WHERE raw_page_id = ${rawPageId}`,
    sql`DELETE FROM vf_pricing_changes WHERE raw_page_id = ${rawPageId}`,
    sql`DELETE FROM vf_partnerships WHERE raw_page_id = ${rawPageId}`,
    sql`DELETE FROM vf_architectural_shifts WHERE raw_page_id = ${rawPageId}`,
  ]);
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
