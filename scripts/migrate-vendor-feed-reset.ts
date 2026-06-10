// migrate-vendor-feed-reset.ts — One-time reset to wipe pre-article-crawl entity data.
// Run once, just before the RSS-driven article scraper (issue #189) goes live.
// Use --dry-run to preview row counts without deleting.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING is not set");

  const sql = neon(connectionString);

  if (isDryRun) console.log("DRY RUN — no data will be deleted\n");

  const [launches, pricing, partnerships, shifts, rawPages] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM vf_feature_launches`,
    sql`SELECT count(*)::int AS n FROM vf_pricing_changes`,
    sql`SELECT count(*)::int AS n FROM vf_partnerships`,
    sql`SELECT count(*)::int AS n FROM vf_architectural_shifts`,
    sql`SELECT count(*)::int AS n FROM vf_raw_pages`,
  ]);

  console.log("Row counts before:");
  console.log(`  vf_feature_launches:    ${launches[0].n}`);
  console.log(`  vf_pricing_changes:     ${pricing[0].n}`);
  console.log(`  vf_partnerships:        ${partnerships[0].n}`);
  console.log(`  vf_architectural_shifts:${shifts[0].n}`);
  console.log(`  vf_raw_pages:           ${rawPages[0].n}`);

  if (isDryRun) {
    console.log("\nDry run complete — no changes made.");
    return;
  }

  // CASCADE truncates all four entity tables via FK dependency in one statement.
  // RESTART IDENTITY resets bigserial sequences back to 1.
  await sql`TRUNCATE vf_raw_pages, vf_feature_launches, vf_pricing_changes, vf_partnerships, vf_architectural_shifts RESTART IDENTITY CASCADE`;

  const [lAfter, pAfter, paAfter, sAfter, rpAfter] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM vf_feature_launches`,
    sql`SELECT count(*)::int AS n FROM vf_pricing_changes`,
    sql`SELECT count(*)::int AS n FROM vf_partnerships`,
    sql`SELECT count(*)::int AS n FROM vf_architectural_shifts`,
    sql`SELECT count(*)::int AS n FROM vf_raw_pages`,
  ]);

  console.log("\nRow counts after:");
  console.log(`  vf_feature_launches:    ${lAfter[0].n}`);
  console.log(`  vf_pricing_changes:     ${pAfter[0].n}`);
  console.log(`  vf_partnerships:        ${paAfter[0].n}`);
  console.log(`  vf_architectural_shifts:${sAfter[0].n}`);
  console.log(`  vf_raw_pages:           ${rpAfter[0].n}`);

  console.log("\n✓ vendor feed data reset complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
