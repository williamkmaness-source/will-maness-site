// Tests for ember-briefing (issue #98).
// Covers prompt construction, response parsing, and graceful error handling.

import { describe, it, expect, vi } from "vitest";
import {
  buildBriefingPrompt,
  parseBriefingResponse,
  generateBriefing,
  type BriefingInput,
} from "./ember-briefing";
import Anthropic from "@anthropic-ai/sdk";

function makeInput(overrides: Partial<BriefingInput> = {}): BriefingInput {
  return {
    frp: 320.5,
    detectionCount: 5,
    lat: 39.123,
    lng: -120.456,
    riskScore: 78,
    windSpeedMph: 28.0,
    humidityPct: 12,
    temperatureF: 94,
    redFlag: true,
    ...overrides,
  };
}

const VALID_RESPONSE = `## Current Situation
A high-intensity fire cluster with 5 detections and 320.5 MW FRP indicates significant active burning.

## Weather Context
Red Flag conditions are active with 28.0 mph winds and 12% humidity, creating extreme fire spread potential.

## 6-Hour Outlook
The combination of high FRP, low humidity, and elevated winds sustains a high risk score of 78, indicating continued Action-tier conditions.`;

describe("buildBriefingPrompt", () => {
  it("includes FRP, detection count, and location from input", () => {
    const prompt = buildBriefingPrompt(makeInput());
    expect(prompt).toContain("320.5 MW");
    expect(prompt).toContain("5 satellite observations");
    expect(prompt).toContain("39.123");
    expect(prompt).toContain("120.456");
  });

  it("includes risk score", () => {
    const prompt = buildBriefingPrompt(makeInput({ riskScore: 82 }));
    expect(prompt).toContain("82 / 100");
  });

  it("includes wind speed when present", () => {
    const prompt = buildBriefingPrompt(makeInput({ windSpeedMph: 22.5 }));
    expect(prompt).toContain("22.5 mph");
  });

  it("shows 'unavailable' when wind speed is null", () => {
    const prompt = buildBriefingPrompt(makeInput({ windSpeedMph: null }));
    expect(prompt).toContain("Wind speed: unavailable");
  });

  it("shows 'unavailable' when humidity is null", () => {
    const prompt = buildBriefingPrompt(makeInput({ humidityPct: null }));
    expect(prompt).toContain("Relative humidity: unavailable");
  });

  it("shows Red Flag YES when redFlag is true", () => {
    const prompt = buildBriefingPrompt(makeInput({ redFlag: true }));
    expect(prompt).toContain("Red Flag conditions: YES");
  });

  it("shows Red Flag NO when redFlag is false", () => {
    const prompt = buildBriefingPrompt(makeInput({ redFlag: false }));
    expect(prompt).toContain("Red Flag conditions: NO");
  });

  it("includes all three section headers in the prompt", () => {
    const prompt = buildBriefingPrompt(makeInput());
    expect(prompt).toContain("## Current Situation");
    expect(prompt).toContain("## Weather Context");
    expect(prompt).toContain("## 6-Hour Outlook");
  });

  it("instructs Claude not to infer beyond provided data", () => {
    const prompt = buildBriefingPrompt(makeInput());
    expect(prompt).toContain("Use ONLY the data provided");
  });
});

describe("parseBriefingResponse", () => {
  it("parses a well-formed response into three sections", () => {
    const result = parseBriefingResponse(VALID_RESPONSE);
    expect(result).not.toBeNull();
    expect(result!.currentSituation).toContain("320.5 MW");
    expect(result!.weatherContext).toContain("Red Flag");
    expect(result!.outlook).toContain("78");
  });

  it("returns null for an empty string", () => {
    expect(parseBriefingResponse("")).toBeNull();
  });

  it("returns null when section headers are missing", () => {
    expect(parseBriefingResponse("Some fire data without headers.")).toBeNull();
  });

  it("returns null when only some headers are present", () => {
    const partial = "## Current Situation\nSomething happened.\n## Weather Context\nIt was hot.";
    expect(parseBriefingResponse(partial)).toBeNull();
  });

  it("returns null when headers are out of order", () => {
    const outOfOrder = `## 6-Hour Outlook\nFoo\n## Current Situation\nBar\n## Weather Context\nBaz`;
    expect(parseBriefingResponse(outOfOrder)).toBeNull();
  });

  it("returns null when section bodies are empty after trimming", () => {
    const empty = `## Current Situation\n\n## Weather Context\n\n## 6-Hour Outlook\n`;
    expect(parseBriefingResponse(empty)).toBeNull();
  });
});

describe("generateBriefing", () => {
  it("returns a parsed BriefingResult when Claude responds with valid text", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: VALID_RESPONSE }],
    });
    const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;

    const result = await generateBriefing(mockClient, makeInput());

    expect(result).not.toBeNull();
    expect(result!.currentSituation).toBeTruthy();
    expect(result!.weatherContext).toBeTruthy();
    expect(result!.outlook).toBeTruthy();
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("returns null when Claude returns an empty content array (malformed response)", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ content: [] });
    const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;

    const result = await generateBriefing(mockClient, makeInput());
    expect(result).toBeNull();
  });

  it("returns null when Claude returns a non-text block (malformed response)", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });
    const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;

    const result = await generateBriefing(mockClient, makeInput());
    expect(result).toBeNull();
  });

  it("returns null when Claude response is missing section headers (malformed body)", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "This is just a plain response without headers." }],
    });
    const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;

    const result = await generateBriefing(mockClient, makeInput());
    expect(result).toBeNull();
  });

  it("returns null and does not throw when the API call throws", async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error("API error"));
    const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;

    const result = await generateBriefing(mockClient, makeInput());
    expect(result).toBeNull();
  });
});
