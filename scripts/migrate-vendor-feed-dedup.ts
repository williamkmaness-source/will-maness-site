/**
 * One-time migration: deduplicate vendor feed entity tables and remove future-dated entries.
 *
 * Run once against prod:
 *   npx tsx scripts/migrate-vendor-feed-dedup.ts
 */

import { neon } from "@neondatabase/serverless";

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("No Postgres connection string found");

  const sql = neon(connectionString);

  // ── feature_launches ────────────────────────────────────────────────────────
  // Keep the oldest row per (company, LOWER(product_name), source_url).
  // Also purge any future-dated rows (hallucinated dates).
  const fl = await sql`
    DELETE FROM vf_feature_launches
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM vf_feature_launches
      GROUP BY company, LOWER(product_name), source_url
    )
    OR release_date > NOW()
  `;
  console.log(`feature_launches: deleted ${fl.length} duplicate/future rows`);

  // ── partnerships ────────────────────────────────────────────────────────────
  const pa = await sql`
    DELETE FROM vf_partnerships
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM vf_partnerships
      GROUP BY company, LOWER(partner_company), source_url
    )
    OR announced_date > NOW()
  `;
  console.log(`partnerships: deleted ${pa.length} duplicate/future rows`);

  // ── pricing_changes ─────────────────────────────────────────────────────────
  const pc = await sql`
    DELETE FROM vf_pricing_changes
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM vf_pricing_changes
      GROUP BY company, LOWER(description), source_url
    )
    OR effective_date > NOW()
  `;
  console.log(`pricing_changes: deleted ${pc.length} duplicate/future rows`);

  // ── architectural_shifts ────────────────────────────────────────────────────
  const as_ = await sql`
    DELETE FROM vf_architectural_shifts
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM vf_architectural_shifts
      GROUP BY company, LOWER(description), source_url
    )
    OR announced_date > NOW()
  `;
  console.log(`architectural_shifts: deleted ${as_.length} duplicate/future rows`);

  console.log("Deduplication complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
