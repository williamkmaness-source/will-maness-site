import { describe, it, expect } from "vitest";
import { chunkText } from "./embedder";

describe("chunkText", () => {
  it("returns an empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns the full text as a single chunk when shorter than chunk size", () => {
    const text = "This is a short paragraph.";
    const result = chunkText(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text);
  });

  it("splits long text at a word boundary before the chunk limit", () => {
    // Build a string that is just over 1500 chars with a known word at the boundary
    const word = "boundary";
    const padding = "x".repeat(1492); // 1492 + 1 space + 8 = 1501 chars before next word
    const text = `${padding} ${word} more text here`;
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // First chunk ends at or before the space — it should not contain the whole string
    expect(chunks[0].length).toBeLessThan(text.length);
    // No chunk exceeds 1500 chars when a word boundary exists
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1500);
    }
  });

  it("hard-splits a run of text with no spaces when no word boundary is available", () => {
    // 3000 chars with no spaces — must produce two chunks each ≤ 1500 chars
    const text = "a".repeat(3000);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1500);
    }
    // Reassembled text matches original (accounting for trim on each chunk)
    expect(chunks.join("")).toBe(text);
  });
});
