// pipeline-vendor-feed.ts — Entry point for the vendor feed pipeline.
// Usage: pnpm tsx scripts/pipeline-vendor-feed.ts <scrape|extract|embed|retry>

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const command = process.argv[2];

if (!["scrape", "extract", "embed", "retry"].includes(command)) {
  console.error("Usage: pipeline-vendor-feed.ts <scrape|extract|embed|retry>");
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
  const { runExtractor } = await import("../src/lib/vendor-feed/extractor");
  await runExtractor(sql);
}

async function embed() {
  const { runEmbedder } = await import("../src/lib/vendor-feed/embedder");
  try {
    await runEmbedder(sql);
  } catch (err) {
    // Fire-and-forget: log but do not fail the pipeline if embeddings are unavailable
    console.error("[embedder] fatal error (non-blocking):", err instanceof Error ? err.message : String(err));
  }
}

async function retry() {
  const { resetFailedToPending } = await import("../src/lib/vendor-feed/db");
  const { runExtractor } = await import("../src/lib/vendor-feed/extractor");
  const reset = await resetFailedToPending(sql);
  console.log(`[retry] reset ${reset} failed row(s) to pending`);
  await runExtractor(sql);
}

const steps: Record<string, () => Promise<void>> = { scrape, extract, embed, retry };

steps[command]().catch((err) => {
  console.error(err);
  process.exit(1);
});
