import { neon } from "@neondatabase/serverless";

const MAX_ENTITY_AGE_MONTHS = 12;
const MAX_FEED_ENTITIES = 500;

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

export interface FeedResult {
  entities: FeedEntity[];
  totalCount: number;
}

export async function getFeedEntities(): Promise<FeedResult> {
  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("No Postgres connection string found");

  const sql = neon(connectionString);

  const rows = await sql`
    SELECT entity_type, id, company, title, description, date, source_url, created_at,
           COUNT(*) OVER () AS total_count
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
      WHERE COALESCE(release_date, created_at) >= NOW() - INTERVAL '1 month' * ${MAX_ENTITY_AGE_MONTHS}

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
      WHERE COALESCE(effective_date, created_at) >= NOW() - INTERVAL '1 month' * ${MAX_ENTITY_AGE_MONTHS}

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
      WHERE COALESCE(announced_date, created_at) >= NOW() - INTERVAL '1 month' * ${MAX_ENTITY_AGE_MONTHS}

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
      WHERE COALESCE(announced_date, created_at) >= NOW() - INTERVAL '1 month' * ${MAX_ENTITY_AGE_MONTHS}
    ) entities
    ORDER BY date DESC NULLS LAST, created_at DESC
    LIMIT ${MAX_FEED_ENTITIES}
  `;

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

  return {
    entities: rows.map((r) => ({
      id: `${r.entity_type}-${r.id}`,
      entityType: r.entity_type as EntityType,
      company: r.company,
      title: r.title,
      description: r.description,
      date: r.date ?? null,
      sourceUrl: r.source_url,
      createdAt: r.created_at,
    })),
    totalCount,
  };
}
