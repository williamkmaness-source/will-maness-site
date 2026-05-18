// pipeline-vendor-feed.ts — Entry point for the vendor feed pipeline.
// Usage: pnpm tsx scripts/pipeline-vendor-feed.ts <scrape|extract|retry>

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const command = process.argv[2];

if (!["scrape", "extract", "retry"].includes(command)) {
  console.error("Usage: pipeline-vendor-feed.ts <scrape|extract|retry>");
  process.exit(1);
}

const connectionString = process.env.POSTGRES_URL_NON_POOLING;
if (!connectionString) {
  console.error("POSTGRES_URL_NON_POOLING is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function scrape() {
  const { runScraper } = await import("../src/lib/vendor-feed/scraper");
  await runScraper(sql);
}

async function extract() {
  console.log("extract: not yet implemented (issues #4, #5)");
}

async function retry() {
  console.log("retry: not yet implemented (issue #6)");
}

const steps: Record<string, () => Promise<void>> = { scrape, extract, retry };

steps[command]().catch((err) => {
  console.error(err);
  process.exit(1);
});
