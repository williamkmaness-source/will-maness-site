import { Index } from "@upstash/vector";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { stripHtml } from "./extractor";
import {
  getUnembeddedRawPageIds,
  getRawPageById,
  markEmbedded,
  type RawPage,
} from "./db";

const CHUNK_SIZE = 1500;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start) end = boundary;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
  }
  return chunks;
}

export async function embedPage(index: Index, page: RawPage): Promise<void> {
  const text = stripHtml(page.raw_content);
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  await index.upsert(
    chunks.map((chunk, i) => ({
      id: `${page.id}-${i}`,
      data: chunk,
      metadata: {
        raw_page_id: page.id,
        company: page.company,
        source_url: page.source_url,
        scraped_at: page.scraped_at.toISOString(),
        chunk_index: i,
      },
    }))
  );
}

export async function runEmbedder(
  sql: NeonQueryFunction<false, false>
): Promise<void> {
  const ids = await getUnembeddedRawPageIds(sql);
  console.log(`[embedder] processing ${ids.length} page(s)`);
  if (ids.length === 0) return;

  const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });

  let embedded = 0;
  let errors = 0;

  for (const id of ids) {
    const page = await getRawPageById(sql, id);
    if (!page) continue; // row vanished between id fetch and load
    try {
      await embedPage(index, page);
      await markEmbedded(sql, page.id);
      embedded++;
      console.log(`[embedder] ${page.company} (${page.source_url}): embedded`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[embedder] failed for ${page.source_url}: ${message}`);
      errors++;
    }
  }

  console.log(`[embedder] done — embedded: ${embedded}, errors: ${errors}`);
}
