// pipeline-music.ts — Entry point for the music analyzer pipeline (issue #215).
// Usage: pnpm tsx scripts/pipeline-music.ts <scrape|extract|score>
// Each command is independently runnable; every execution upserts pipeline_runs.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const COMMANDS = ["scrape", "extract", "score"] as const;
type Command = (typeof COMMANDS)[number];

const command = process.argv[2] as Command;

if (!COMMANDS.includes(command)) {
  console.error(`Usage: pipeline-music.ts <${COMMANDS.join("|")}>`);
  process.exit(1);
}

const connectionString = process.env.POSTGRES_URL_NON_POOLING;
if (!connectionString) {
  console.error("POSTGRES_URL_NON_POOLING is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function scrape(): Promise<number> {
  const { runScrape } = await import("../src/lib/music-analyzer/music-pipeline");
  const result = await runScrape(sql);
  return result.scraped;
}

async function extract(): Promise<number> {
  const { runExtract } = await import("../src/lib/music-analyzer/music-pipeline");
  const { SpotifyClient } = await import("../src/lib/music-analyzer/spotify-client");

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set");
  }

  const result = await runExtract(sql, new SpotifyClient(clientId, clientSecret));
  return result.extracted;
}

async function score(): Promise<number> {
  const { runScore } = await import("../src/lib/music-analyzer/music-pipeline");
  const result = await runScore(sql);
  return result.scoreCount;
}

const steps: Record<Command, () => Promise<number>> = { scrape, extract, score };

async function main(): Promise<void> {
  const { recordPipelineRun } = await import("../src/lib/music-analyzer/music-pipeline");

  try {
    const recordCount = await steps[command]();
    await recordPipelineRun(sql, "success", recordCount, null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordPipelineRun(sql, "failed", null, `${command}: ${message}`);
    console.error(err);
    process.exit(1);
  }
}

void main();
