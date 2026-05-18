// pipeline-vendor-feed.ts — Entry point for the vendor feed pipeline.
// Usage: pnpm tsx scripts/pipeline-vendor-feed.ts <scrape|extract|retry>

import { config } from "dotenv";

config({ path: ".env.local" });

const command = process.argv[2];

if (!["scrape", "extract", "retry"].includes(command)) {
  console.error("Usage: pipeline-vendor-feed.ts <scrape|extract|retry>");
  process.exit(1);
}

// Stubs — replaced by issues #3, #4/#5, #6
async function scrape() {
  console.log("scrape: not yet implemented (issue #3)");
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
