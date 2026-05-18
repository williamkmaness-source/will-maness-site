import Anthropic from "@anthropic-ai/sdk";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import {
  getPendingRawPages,
  insertFeatureLaunch,
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

export interface ExtractedFeatureLaunch {
  product_name: string;
  description: string;
  release_date: string | null;
}

export type CallClaudeFn = (
  content: string,
  company: string,
  sourceUrl: string
) => Promise<ExtractedFeatureLaunch[]>;

export async function callClaude(
  content: string,
  company: string,
  sourceUrl: string
): Promise<ExtractedFeatureLaunch[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const cleaned = stripHtml(content).slice(0, MAX_CONTENT_CHARS);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    tools: [
      {
        name: "record_feature_launches",
        description:
          "Record all product feature launches, new capabilities, or significant releases found in the content. Return an empty array if none are found.",
        input_schema: {
          type: "object" as const,
          properties: {
            feature_launches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_name: {
                    type: "string",
                    description: "Name of the product, feature, or capability launched",
                  },
                  description: {
                    type: "string",
                    description: "1–3 sentence description of what was launched and why it matters",
                  },
                  release_date: {
                    type: "string",
                    description: "ISO date YYYY-MM-DD of the launch, or null if not mentioned",
                  },
                },
                required: ["product_name", "description", "release_date"],
              },
            },
          },
          required: ["feature_launches"],
        },
      },
    ],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `You are analyzing content from ${company}'s engineering blog or GitHub releases page (source: ${sourceUrl}).

Extract all feature launches: new products, features, capabilities, or significant releases announced in this content.

Content:
${cleaned}`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }

  const input = toolUse.input as { feature_launches: ExtractedFeatureLaunch[] };
  if (!Array.isArray(input.feature_launches)) {
    throw new Error("Claude returned malformed tool input: feature_launches is not an array");
  }

  return input.feature_launches;
}

export async function extractFromPage(
  sql: NeonQueryFunction<false, false>,
  rawPage: RawPage,
  callFn: CallClaudeFn = callClaude
): Promise<void> {
  try {
    const launches = await callFn(rawPage.raw_content, rawPage.company, rawPage.source_url);

    for (const launch of launches) {
      await insertFeatureLaunch(sql, {
        rawPageId: rawPage.id,
        company: rawPage.company,
        productName: launch.product_name,
        description: launch.description,
        releaseDate: launch.release_date ?? null,
        sourceUrl: rawPage.source_url,
      });
    }

    await markExtracted(sql, rawPage.id);
    console.log(
      `[extractor] ${rawPage.company} (${rawPage.source_url}): ${launches.length} launch(es)`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[extractor] failed for ${rawPage.source_url}: ${message}`);
    await markFailed(sql, rawPage.id, message);
  }
}

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
