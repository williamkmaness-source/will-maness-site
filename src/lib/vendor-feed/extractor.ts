import Anthropic from "@anthropic-ai/sdk";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
  getPendingRawPages,
  insertFeatureLaunch,
  insertPricingChange,
  insertPartnership,
  insertArchitecturalShift,
  markExtracted,
  markFailed,
  type RawPage,
} from "./db";

const MAX_CONTENT_CHARS = 60_000;

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

Content:
${cleaned}`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  const input = toolUse.input as ExtractedEntities;
  for (const key of ["feature_launches", "pricing_changes", "partnerships", "architectural_shifts"] as const) {
    if (!Array.isArray(input[key])) {
      throw new Error(`Claude returned malformed tool input: ${key} is not an array`);
    }
  }

  return input;
}

// ── Per-page extraction ───────────────────────────────────────────────────────

export async function extractFromPage(
  sql: NeonQueryFunction<false, false>,
  rawPage: RawPage,
  callFn: CallClaudeFn = callClaude
): Promise<void> {
  try {
    const entities = await callFn(rawPage.raw_content, rawPage.company, rawPage.source_url);

    for (const e of entities.feature_launches) {
      await insertFeatureLaunch(sql, {
        rawPageId: rawPage.id,
        company: rawPage.company,
        productName: e.product_name,
        description: e.description,
        releaseDate: e.release_date ?? null,
        sourceUrl: rawPage.source_url,
      });
    }

    for (const e of entities.pricing_changes) {
      await insertPricingChange(sql, {
        rawPageId: rawPage.id,
        company: rawPage.company,
        description: e.description,
        direction: e.direction ?? null,
        effectiveDate: e.effective_date ?? null,
        sourceUrl: rawPage.source_url,
      });
    }

    for (const e of entities.partnerships) {
      await insertPartnership(sql, {
        rawPageId: rawPage.id,
        company: rawPage.company,
        partnerCompany: e.partner_company,
        integrationType: e.integration_type ?? null,
        description: e.description,
        announcedDate: e.announced_date ?? null,
        sourceUrl: rawPage.source_url,
      });
    }

    for (const e of entities.architectural_shifts) {
      await insertArchitecturalShift(sql, {
        rawPageId: rawPage.id,
        company: rawPage.company,
        fromTechnology: e.from_technology ?? null,
        toTechnology: e.to_technology ?? null,
        description: e.description,
        announcedDate: e.announced_date ?? null,
        sourceUrl: rawPage.source_url,
      });
    }

    const total =
      entities.feature_launches.length +
      entities.pricing_changes.length +
      entities.partnerships.length +
      entities.architectural_shifts.length;

    await markExtracted(sql, rawPage.id);
    console.log(
      `[extractor] ${rawPage.company} (${rawPage.source_url}): ${total} entity(ies) — ` +
        `launches:${entities.feature_launches.length} pricing:${entities.pricing_changes.length} ` +
        `partners:${entities.partnerships.length} arch:${entities.architectural_shifts.length}`
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
  const pages = await getPendingRawPages(sql);
  console.log(`[extractor] processing ${pages.length} pending page(s)`);
  for (const page of pages) {
    await extractFromPage(sql, page, callFn);
  }
}
