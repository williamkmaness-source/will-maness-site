import Anthropic from "@anthropic-ai/sdk";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
  getPendingRawPageIds,
  getRawPageById,
  deleteEntitiesForPage,
  insertFeatureLaunch,
  insertPricingChange,
  insertPartnership,
  insertArchitecturalShift,
  markExtracted,
  markFailed,
  type RawPage,
} from "./db";

const MAX_CONTENT_CHARS = 60_000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(val: unknown): string | null {
  if (typeof val !== "string" || !ISO_DATE_RE.test(val)) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  if (d > new Date()) return null;
  return val;
}

function isStale(dateStr: string | null, scrapedAt: Date): boolean {
  if (!dateStr) return false;
  const entityDate = new Date(dateStr);
  if (isNaN(entityDate.getTime())) return false;
  const diffDays = (scrapedAt.getTime() - entityDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 90;
}

export function extractCanonicalDate(html: string): string | null {
  const jsonLdMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (jsonLdMatch) {
    const d = normalizeDate(jsonLdMatch[1].slice(0, 10));
    if (d) return d;
  }
  const metaMatch = html.match(/<meta\s+[^>]*property="article:published_time"[^>]*content="([^"]+)"/i)
    ?? html.match(/<meta\s+[^>]*content="([^"]+)"[^>]*property="article:published_time"/i);
  if (metaMatch) {
    const d = normalizeDate(metaMatch[1].slice(0, 10));
    if (d) return d;
  }
  const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"/i);
  if (timeMatch) {
    const d = normalizeDate(timeMatch[1].slice(0, 10));
    if (d) return d;
  }
  return null;
}

export function validateEntityDate(llmDate: string | null, canonicalDate: string | null): string | null {
  // If we have a deterministic canonical date from metadata, we trust it more than LLM.
  // The LLM only sees stripped text and may mistakenly guess the scrape date or wrapper page date.
  if (canonicalDate) return canonicalDate;
  return normalizeDate(llmDate);
}

// GitHub releases pages list multiple releases inline — each with its own date.
// The page-level canonical date is the most-recent release, which would incorrectly
// override the per-release dates Claude extracts for older entries on the same page.
export function isGitHubReleasesUrl(url: string): boolean {
  return url.includes("github.com") && url.includes("/releases");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Extracted entity shapes (Claude tool output) ──────────────────────────────

export interface ExtractedFeatureLaunch {
  product_name: string;
  description: string;
  release_date: string | null;
}

export interface ExtractedPricingChange {
  description: string;
  direction: string | null;
  effective_date: string | null;
}

export interface ExtractedPartnership {
  partner_company: string;
  integration_type: string | null;
  description: string;
  announced_date: string | null;
}

export interface ExtractedArchitecturalShift {
  from_technology: string | null;
  to_technology: string | null;
  description: string;
  announced_date: string | null;
}

export interface ExtractedEntities {
  feature_launches: ExtractedFeatureLaunch[];
  pricing_changes: ExtractedPricingChange[];
  partnerships: ExtractedPartnership[];
  architectural_shifts: ExtractedArchitecturalShift[];
}

export type CallClaudeFn = (
  content: string,
  company: string,
  sourceUrl: string
) => Promise<ExtractedEntities>;

// ── Claude call ───────────────────────────────────────────────────────────────

export async function callClaude(
  content: string,
  company: string,
  sourceUrl: string
): Promise<ExtractedEntities> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const cleaned = stripHtml(content).slice(0, MAX_CONTENT_CHARS);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    tools: [
      {
        name: "record_entities",
        description:
          "Record all market intelligence entities found in the content. Return empty arrays for categories with no findings.",
        input_schema: {
          type: "object" as const,
          properties: {
            feature_launches: {
              type: "array",
              description: "New products, features, or capabilities announced or released",
              items: {
                type: "object",
                properties: {
                  product_name: { type: "string" },
                  description: { type: "string", description: "1–3 sentence summary" },
                  release_date: { type: "string", description: "YYYY-MM-DD or null" },
                },
                required: ["product_name", "description", "release_date"],
              },
            },
            pricing_changes: {
              type: "array",
              description: "Pricing updates, tier changes, or new pricing models",
              items: {
                type: "object",
                properties: {
                  description: { type: "string", description: "1–3 sentence summary" },
                  direction: {
                    type: "string",
                    description: "increase, decrease, new tier, restructure, or null",
                  },
                  effective_date: { type: "string", description: "YYYY-MM-DD or null" },
                },
                required: ["description", "direction", "effective_date"],
              },
            },
            partnerships: {
              type: "array",
              description: "Partner announcements, integrations, or ecosystem deals",
              items: {
                type: "object",
                properties: {
                  partner_company: { type: "string" },
                  integration_type: {
                    type: "string",
                    description: "native connector, certification, OEM, marketplace listing, etc. or null",
                  },
                  description: { type: "string", description: "1–3 sentence summary" },
                  announced_date: { type: "string", description: "YYYY-MM-DD or null" },
                },
                required: ["partner_company", "description", "integration_type", "announced_date"],
              },
            },
            architectural_shifts: {
              type: "array",
              description: "Significant changes to technical architecture, infrastructure, or core technology",
              items: {
                type: "object",
                properties: {
                  from_technology: { type: "string", description: "Technology being replaced or null" },
                  to_technology: { type: "string", description: "Replacement technology or null" },
                  description: { type: "string", description: "1–3 sentence summary" },
                  announced_date: { type: "string", description: "YYYY-MM-DD or null" },
                },
                required: ["from_technology", "to_technology", "description", "announced_date"],
              },
            },
          },
          required: [
            "feature_launches",
            "pricing_changes",
            "partnerships",
            "architectural_shifts",
          ],
        },
      },
    ],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `You are analyzing content from ${company}'s engineering blog or GitHub releases page (source: ${sourceUrl}).

Extract all market intelligence entities: feature launches, pricing changes, partnerships, and architectural shifts.

CRITICAL DATE INSTRUCTION: Extract the exact article-level publication or announcement date. Do NOT extract the current scraped date, or the date of a wrapper page that aggregates multiple posts. If the specific announcement date for an entity is unclear, return null.${isGitHubReleasesUrl(sourceUrl) ? "\n\nSOURCE TYPE: GitHub releases page. Multiple releases are listed inline, each with its own date in the section heading. Use the date from each release's own heading — do NOT use the page-level date for all releases." : ""}

Content:
${cleaned}`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  const raw = toolUse.input as Record<string, unknown>;

  // Defensive: if Claude omits or mis-types a field, default to empty array
  return {
    feature_launches: Array.isArray(raw.feature_launches) ? (raw.feature_launches as ExtractedFeatureLaunch[]) : [],
    pricing_changes: Array.isArray(raw.pricing_changes) ? (raw.pricing_changes as ExtractedPricingChange[]) : [],
    partnerships: Array.isArray(raw.partnerships) ? (raw.partnerships as ExtractedPartnership[]) : [],
    architectural_shifts: Array.isArray(raw.architectural_shifts) ? (raw.architectural_shifts as ExtractedArchitecturalShift[]) : [],
  };
}

// ── Per-page extraction ───────────────────────────────────────────────────────

export async function extractFromPage(
  sql: NeonQueryFunction<false, false>,
  rawPage: RawPage,
  callFn: CallClaudeFn = callClaude
): Promise<void> {
  try {
    // GitHub releases pages embed multiple releases with individual dates — the page-level
    // canonical date is only the most-recent release and must not override per-release dates.
    const canonicalDate = isGitHubReleasesUrl(rawPage.source_url)
      ? null
      : extractCanonicalDate(rawPage.raw_content);
    const entities = await callFn(rawPage.raw_content, rawPage.company, rawPage.source_url);

    await deleteEntitiesForPage(sql, rawPage.id);
    let insertedCount = 0;

    // Dedup sets: prevent Claude from inserting the same entity twice in one extraction pass.
    // Duplicate product names from the same blog post are a known failure mode (#89).
    const seenLaunchKeys = new Set<string>();
    const seenPricingKeys = new Set<string>();
    const seenPartnershipKeys = new Set<string>();
    const seenShiftKeys = new Set<string>();

    for (const e of entities.feature_launches) {
      const dedupKey = e.product_name.toLowerCase();
      if (seenLaunchKeys.has(dedupKey)) {
        console.log(`[extractor] skipped intra-page duplicate feature launch from ${rawPage.company}: ${e.product_name}`);
        continue;
      }
      seenLaunchKeys.add(dedupKey);
      const releaseDate = validateEntityDate(e.release_date, canonicalDate);
      if (isStale(releaseDate, rawPage.scraped_at)) {
        console.log(`[extractor] skipped stale feature launch from ${rawPage.company}: ${e.product_name} (${releaseDate})`);
        continue;
      }
      await insertFeatureLaunch(sql, {
        rawPageId: rawPage.id,
        company: rawPage.company,
        productName: e.product_name,
        description: e.description,
        releaseDate,
        sourceUrl: rawPage.source_url,
      });
      insertedCount++;
    }

    for (const e of entities.pricing_changes) {
      const dedupKey = e.description.toLowerCase().slice(0, 80);
      if (seenPricingKeys.has(dedupKey)) {
        console.log(`[extractor] skipped intra-page duplicate pricing change from ${rawPage.company}`);
        continue;
      }
      seenPricingKeys.add(dedupKey);
      const effectiveDate = validateEntityDate(e.effective_date, canonicalDate);
      if (isStale(effectiveDate, rawPage.scraped_at)) {
        console.log(`[extractor] skipped stale pricing change from ${rawPage.company}: (${effectiveDate})`);
        continue;
      }
      await insertPricingChange(sql, {
        rawPageId: rawPage.id,
        company: rawPage.company,
        description: e.description,
        direction: e.direction ?? null,
        effectiveDate,
        sourceUrl: rawPage.source_url,
      });
      insertedCount++;
    }

    for (const e of entities.partnerships) {
      const dedupKey = e.partner_company.toLowerCase();
      if (seenPartnershipKeys.has(dedupKey)) {
        console.log(`[extractor] skipped intra-page duplicate partnership from ${rawPage.company}: ${e.partner_company}`);
        continue;
      }
      seenPartnershipKeys.add(dedupKey);
      const announcedDate = validateEntityDate(e.announced_date, canonicalDate);
      if (isStale(announcedDate, rawPage.scraped_at)) {
        console.log(`[extractor] skipped stale partnership from ${rawPage.company}: ${e.partner_company} (${announcedDate})`);
        continue;
      }
      await insertPartnership(sql, {
        rawPageId: rawPage.id,
        company: rawPage.company,
        partnerCompany: e.partner_company,
        integrationType: e.integration_type ?? null,
        description: e.description,
        announcedDate,
        sourceUrl: rawPage.source_url,
      });
      insertedCount++;
    }

    for (const e of entities.architectural_shifts) {
      const dedupKey = `${(e.from_technology ?? '').toLowerCase()}->${(e.to_technology ?? '').toLowerCase()}`;
      if (seenShiftKeys.has(dedupKey)) {
        console.log(`[extractor] skipped intra-page duplicate architectural shift from ${rawPage.company}`);
        continue;
      }
      seenShiftKeys.add(dedupKey);
      const announcedDate = validateEntityDate(e.announced_date, canonicalDate);
      if (isStale(announcedDate, rawPage.scraped_at)) {
        console.log(`[extractor] skipped stale architecture shift from ${rawPage.company}: (${announcedDate})`);
        continue;
      }
      await insertArchitecturalShift(sql, {
        rawPageId: rawPage.id,
        company: rawPage.company,
        fromTechnology: e.from_technology ?? null,
        toTechnology: e.to_technology ?? null,
        description: e.description,
        announcedDate,
        sourceUrl: rawPage.source_url,
      });
      insertedCount++;
    }

    const totalRaw =
      entities.feature_launches.length +
      entities.pricing_changes.length +
      entities.partnerships.length +
      entities.architectural_shifts.length;

    await markExtracted(sql, rawPage.id);
    console.log(
      `[extractor] ${rawPage.company} (${rawPage.source_url}): inserted ${insertedCount}/${totalRaw} entities`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[extractor] failed for ${rawPage.source_url}: ${message}`);
    await markFailed(sql, rawPage.id, message);
  }
}

// ── Run all pending pages ─────────────────────────────────────────────────────

export async function runExtractor(
  sql: NeonQueryFunction<false, false>,
  callFn: CallClaudeFn = callClaude
): Promise<void> {
  const ids = await getPendingRawPageIds(sql);
  console.log(`[extractor] processing ${ids.length} pending page(s)`);
  for (const id of ids) {
    const page = await getRawPageById(sql, id);
    if (!page) continue; // row vanished between id fetch and load
    await extractFromPage(sql, page, callFn);
  }
}
