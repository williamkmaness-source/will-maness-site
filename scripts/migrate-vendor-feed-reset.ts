// migrate-vendor-feed-reset.ts — One-time reset: truncates all vendor-feed entity tables
// and clears vf_raw_pages. Run once, just before the article-level scraper goes live.
// Uses POSTGRES_URL_NON_POOLING (direct connection required for DML).
//
// Usage:
//   pnpm tsx scripts/migrate-vendor-feed-reset.ts            # live reset
//   pnpm tsx scripts/migrate-vendor-feed-reset.ts --dry-run  # print counts only

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING is not set");

  const sql = neon(connectionString);

  const [rawPages] = await sql`SELECT COUNT(*)::int AS count FROM vf_raw_pages`;
  const [featureLaunches] = await sql`SELECT COUNT(*)::int AS count FROM vf_feature_launches`;
  const [pricingChanges] = await sql`SELECT COUNT(*)::int AS count FROM vf_pricing_changes`;
  const [partnerships] = await sql`SELECT COUNT(*)::int AS count FROM vf_partnerships`;
  const [archShifts] = await sql`SELECT COUNT(*)::int AS count FROM vf_architectural_shifts`;

  console.log("Row counts before reset:");
  console.log(`  vf_raw_pages:           ${rawPages.count}`);
  console.log(`  vf_feature_launches:    ${featureLaunches.count}`);
  console.log(`  vf_pricing_changes:     ${pricingChanges.count}`);
  console.log(`  vf_partnerships:        ${partnerships.count}`);
  console.log(`  vf_architectural_shifts:${archShifts.count}`);

  if (isDryRun) {
    console.log("\n--dry-run: no rows deleted.");
    return;
  }

  // Truncate entity tables (CASCADE clears FK-referencing rows if any remain)
  await sql`TRUNCATE vf_feature_launches, vf_pricing_changes, vf_partnerships, vf_architectural_shifts CASCADE`;
  await sql`DELETE FROM vf_raw_pages`;

  const [rawPagesAfter] = await sql`SELECT COUNT(*)::int AS count FROM vf_raw_pages`;
  const [flAfter] = await sql`SELECT COUNT(*)::int AS count FROM vf_feature_launches`;

  console.log("\nRow counts after reset:");
  console.log(`  vf_raw_pages:           ${rawPagesAfter.count}`);
  console.log(`  vf_feature_launches:    ${flAfter.count}`);
  console.log("\n✓ vendor feed reset complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
