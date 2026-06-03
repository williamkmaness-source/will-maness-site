// migrate-vendor-feed-embeddings.ts — Adds embedded_at to vf_raw_pages.
// Safe to re-run (ADD COLUMN IF NOT EXISTS).

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING is not set");

  const sql = neon(connectionString);

  await sql`
    ALTER TABLE vf_raw_pages
    ADD COLUMN IF NOT EXISTS embedded_at timestamptz
  `;

  console.log("✓ vendor feed embeddings migration complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
