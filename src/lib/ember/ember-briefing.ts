// ember-briefing.ts — AI situation briefings for Action-tier fire clusters (issue #98).
// Pure module: prompt construction, response parsing, and Claude API call.
// Only called for Action-tier clusters; gracefully skips when ANTHROPIC_API_KEY is absent.

import Anthropic from "@anthropic-ai/sdk";

export interface BriefingInput {
  frp: number;
  detectionCount: number;
  lat: number;
  lng: number;
  riskScore: number;
  windSpeedMph: number | null;
  humidityPct: number | null;
  temperatureF: number | null;
  redFlag: boolean;
}

export interface BriefingResult {
  currentSituation: string;
  weatherContext: string;
  outlook: string;
}

const MODEL = "claude-haiku-4-5-20251001";

// Section delimiters used in the prompt and parser.
const SECTION_CURRENT = "## Current Situation";
const SECTION_WEATHER = "## Weather Context";
const SECTION_OUTLOOK = "## 6-Hour Outlook";

export function buildBriefingPrompt(input: BriefingInput): string {
  const windLine =
    input.windSpeedMph != null
      ? `Wind speed: ${input.windSpeedMph.toFixed(1)} mph`
      : "Wind speed: unavailable";
  const humidityLine =
    input.humidityPct != null
      ? `Relative humidity: ${input.humidityPct.toFixed(0)}%`
      : "Relative humidity: unavailable";
  const tempLine =
    input.temperatureF != null
      ? `Temperature: ${input.temperatureF.toFixed(0)}°F`
      : "Temperature: unavailable";
  const redFlagLine = `Red Flag conditions: ${input.redFlag ? "YES" : "NO"}`;

  return `You are a fire monitoring system generating a situation briefing. Use ONLY the data provided below. Do not infer, speculate, or add any information not explicitly present in this data.

CLUSTER DATA:
- Fire Radiative Power (FRP): ${input.frp.toFixed(1)} MW
- Detection count: ${input.detectionCount} satellite observations
- Location: ${input.lat.toFixed(3)}°N, ${Math.abs(input.lng).toFixed(3)}°W
- Risk score: ${input.riskScore.toFixed(0)} / 100

WEATHER CONDITIONS (nearest station):
- ${windLine}
- ${humidityLine}
- ${tempLine}
- ${redFlagLine}

Write a three-part briefing using exactly these section headers (include the ## prefix):

${SECTION_CURRENT}
One sentence describing the current fire intensity based on FRP and detection count.

${SECTION_WEATHER}
One sentence describing the weather conditions relevant to fire behavior.

${SECTION_OUTLOOK}
One sentence describing the near-term risk outlook based solely on the data above. Do not reference external forecasts.`;
}

export function parseBriefingResponse(text: string): BriefingResult | null {
  if (!text || typeof text !== "string") return null;

  const currentIdx = text.indexOf(SECTION_CURRENT);
  const weatherIdx = text.indexOf(SECTION_WEATHER);
  const outlookIdx = text.indexOf(SECTION_OUTLOOK);

  if (currentIdx === -1 || weatherIdx === -1 || outlookIdx === -1) return null;
  if (!(currentIdx < weatherIdx && weatherIdx < outlookIdx)) return null;

  const extract = (start: number, end: number): string =>
    text
      .slice(start, end)
      .replace(/^##[^\n]*\n/, "")
      .trim();

  const currentSituation = extract(currentIdx, weatherIdx);
  const weatherContext = extract(weatherIdx, outlookIdx);
  const outlook = extract(outlookIdx, text.length);

  if (!currentSituation || !weatherContext || !outlook) return null;

  return { currentSituation, weatherContext, outlook };
}

export async function generateBriefing(
  client: Anthropic,
  input: BriefingInput
): Promise<BriefingResult | null> {
  const prompt = buildBriefingPrompt(input);
  let rawText: string;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") return null;
    rawText = block.text;
  } catch (err) {
    console.error("[ember-briefing] API call failed:", err instanceof Error ? err.message : err);
    return null;
  }

  return parseBriefingResponse(rawText);
}
