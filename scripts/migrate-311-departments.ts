// migrate-311-departments.ts — Adds include_in_dashboard column to request_type_meta,
// reclassifies Needle Program to Boston Public Health Commission, and excludes
// non-operational departments from the staffing dashboard.
// Safe to re-run (ALTER uses IF NOT EXISTS).
// Run: pnpm tsx scripts/migrate-311-departments.ts

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error("POSTGRES_URL_NON_POOLING is not set");
  }

  const sql = neon(connectionString);

  // Step 1: add the column. DEFAULT true means all existing rows are included
  // until explicitly opted out below.
  console.log("Adding include_in_dashboard column...");
  await sql`
    ALTER TABLE request_type_meta
    ADD COLUMN IF NOT EXISTS include_in_dashboard BOOLEAN NOT NULL DEFAULT true
  `;

  // Step 2: reclassify Needle Program. The CKAN subject field maps it to
  // "Mayor's 24 Hour Hotline" (legacy intake routing), but operationally it
  // belongs to Boston Public Health Commission.
  console.log("Reclassifying Needle Program → Boston Public Health Commission...");
  const needleResult = await sql`
    UPDATE request_type_meta
    SET department = 'Boston Public Health Commission'
    WHERE request_type = 'Needle Program'
  `;
  console.log(`  Updated ${(needleResult as any).rowCount ?? "?"} row(s).`);

  // Step 3: exclude Mayor's 24 Hour Hotline entries (except Needle Program, now
  // reclassified). This is a legacy intake routing label, not an operational dept.
  console.log("Excluding Mayor's 24 Hour Hotline entries...");
  const mayorResult = await sql`
    UPDATE request_type_meta
    SET include_in_dashboard = false
    WHERE department = 'Mayor''s 24 Hour Hotline'
      AND request_type != 'Needle Program'
  `;
  console.log(`  Excluded ${(mayorResult as any).rowCount ?? "?"} row(s).`);

  // Step 4: exclude Neighborhood Services — 16-person liaison team, not operational.
  console.log("Excluding Neighborhood Services Issues...");
  const nsResult = await sql`
    UPDATE request_type_meta
    SET include_in_dashboard = false
    WHERE request_type = 'Neighborhood Services Issues'
  `;
  console.log(`  Excluded ${(nsResult as any).rowCount ?? "?"} row(s).`);

  // Step 5: seed rows for departments whose cases all have sla_days = NULL.
  // The pipeline's GROUP BY filters WHERE sla_days IS NOT NULL, so these request_types
  // never get inserted by the pipeline. We seed them here so all 9 dashboard departments
  // are represented in request_type_meta. ON CONFLICT DO NOTHING keeps this idempotent.
  console.log("Seeding missing department rows (no SLA data in case_events)...");
  const seedRows = [
    { request_type: "Needle Program",           department: "Boston Public Health Commission" },
    { request_type: "Animal Issues",            department: "Animal Control" },
    { request_type: "Noise Disturbance",        department: "Boston Police Department" },
    { request_type: "Catchbasin",               department: "Boston Water & Sewer Commission" },
    { request_type: "Sidewalk Cover / Manhole", department: "Boston Water & Sewer Commission" },
    { request_type: "Fire Hydrant",             department: "Boston Water & Sewer Commission" },
  ];
  for (const row of seedRows) {
    await sql`
      INSERT INTO request_type_meta (request_type, department, sla_days, last_updated)
      VALUES (${row.request_type}, ${row.department}, NULL, CURRENT_DATE)
      ON CONFLICT (request_type) DO NOTHING
    `;
  }
  console.log(`  Seeded ${seedRows.length} rows.`);

  // Verification: print the 9 expected dashboard departments.
  console.log("\nVerifying — departments with include_in_dashboard = true:");
  const rows = await sql`
    SELECT department, COUNT(*) AS request_type_count
    FROM request_type_meta
    WHERE include_in_dashboard = true
    GROUP BY department
    ORDER BY department
  `;
  for (const row of rows as any[]) {
    console.log(`  ${row.department} (${row.request_type_count} request types)`);
  }

  const deptCount = (rows as any[]).length;
  if (deptCount !== 9) {
    console.warn(`\nWARNING: expected 9 departments, found ${deptCount}. Review the results above.`);
  } else {
    console.log("\n9 departments confirmed. Migration complete.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
