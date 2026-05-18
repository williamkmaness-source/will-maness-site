import { neon } from "@neondatabase/serverless";

export type EntityType =
  | "feature_launch"
  | "pricing_change"
  | "partnership"
  | "architectural_shift";

export interface FeedEntity {
  id: string;
  entityType: EntityType;
  company: string;
  title: string;
  description: string;
  date: string | null;
  sourceUrl: string;
  createdAt: string;
}

export async function getFeedEntities(): Promise<FeedEntity[]> {
  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("No Postgres connection string found");

  const sql = neon(connectionString);

  const rows = await sql`
    SELECT entity_type, id, company, title, description, date, source_url, created_at
    FROM (
      SELECT
        'feature_launch'         AS entity_type,
        id::text,
        company,
        product_name             AS title,
        description,
        release_date::text       AS date,
        source_url,
        created_at
      FROM vf_feature_launches

      UNION ALL

      SELECT
        'pricing_change'         AS entity_type,
        id::text,
        company,
        company || ' pricing update' AS title,
        description,
        effective_date::text     AS date,
        source_url,
        created_at
      FROM vf_pricing_changes

      UNION ALL

      SELECT
        'partnership'            AS entity_type,
        id::text,
        company,
        partner_company          AS title,
        description,
        announced_date::text     AS date,
        source_url,
        created_at
      FROM vf_partnerships

      UNION ALL

      SELECT
        'architectural_shift'    AS entity_type,
        id::text,
        company,
        COALESCE(
          NULLIF(from_technology, '') || ' → ' || NULLIF(to_technology, ''),
          'Architecture shift'
        )                        AS title,
        description,
        announced_date::text     AS date,
        source_url,
        created_at
      FROM vf_architectural_shifts
    ) entities
    ORDER BY created_at DESC, date DESC NULLS LAST
  `;

  return rows.map((r) => ({
    id: `${r.entity_type}-${r.id}`,
    entityType: r.entity_type as EntityType,
    company: r.company,
    title: r.title,
    description: r.description,
    date: r.date ?? null,
    sourceUrl: r.source_url,
    createdAt: r.created_at,
  }));
}
