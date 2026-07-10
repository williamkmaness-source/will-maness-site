// Tests for the music-analyzer feature extractor (issue #214).
// Static fixture data only — no network calls.

import { describe, it, expect } from "vitest";
import {
  getKeyMode,
  getBpmRange,
  getSongStructure,
  getChordFlavor,
  extractFeatures,
  type AudioAnalysisSection,
} from "./feature-extractor";

describe("getKeyMode", () => {
  it("maps every pitch class (0–11) to its key name", () => {
    const expected = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    expected.forEach((name, key) => {
      expect(getKeyMode({ key, mode: 1 })).toBe(`${name} Major`);
    });
  });

  it("labels mode 1 as Major and mode 0 as Minor", () => {
    expect(getKeyMode({ key: 0, mode: 1 })).toBe("C Major");
    expect(getKeyMode({ key: 9, mode: 0 })).toBe("A Minor");
  });
});

describe("getBpmRange", () => {
  it("buckets tempos below 60 as <60", () => {
    expect(getBpmRange(59)).toBe("<60");
  });

  it("covers the 60-79 boundary", () => {
    expect(getBpmRange(60)).toBe("60-79");
    expect(getBpmRange(79)).toBe("60-79");
  });

  it("covers the 80-99 boundary", () => {
    expect(getBpmRange(80)).toBe("80-99");
    expect(getBpmRange(99)).toBe("80-99");
  });

  it("covers the 100-119 boundary", () => {
    expect(getBpmRange(100)).toBe("100-119");
    expect(getBpmRange(119)).toBe("100-119");
  });

  it("covers the 120-139 boundary", () => {
    expect(getBpmRange(120)).toBe("120-139");
    expect(getBpmRange(139)).toBe("120-139");
  });

  it("buckets 140 and above as 140+", () => {
    expect(getBpmRange(140)).toBe("140+");
    expect(getBpmRange(200)).toBe("140+");
  });
});

describe("getSongStructure", () => {
  it("classifies 1-4 sections as compact", () => {
    expect(getSongStructure(1)).toBe("compact");
    expect(getSongStructure(4)).toBe("compact");
  });

  it("classifies 5-7 sections as standard", () => {
    expect(getSongStructure(5)).toBe("standard");
    expect(getSongStructure(7)).toBe("standard");
  });

  it("classifies 8+ sections as extended", () => {
    expect(getSongStructure(8)).toBe("extended");
    expect(getSongStructure(12)).toBe("extended");
  });
});

describe("getChordFlavor", () => {
  it("classifies a single repeated key as single-key", () => {
    const sections: AudioAnalysisSection[] = [
      { key: 0, mode: 1 },
      { key: 0, mode: 1 },
      { key: 0, mode: 1 },
    ];
    expect(getChordFlavor(sections)).toBe("single-key");
  });

  it("classifies a dominant key with brief movement as modal-shift", () => {
    const sections: AudioAnalysisSection[] = [
      { key: 0, mode: 1 },
      { key: 0, mode: 1 },
      { key: 0, mode: 1 },
      { key: 7, mode: 1 },
    ];
    expect(getChordFlavor(sections)).toBe("modal-shift");
  });

  it("classifies evenly-distributed keys as modulating", () => {
    const sections: AudioAnalysisSection[] = [
      { key: 0, mode: 1 },
      { key: 4, mode: 1 },
      { key: 7, mode: 1 },
      { key: 9, mode: 0 },
    ];
    expect(getChordFlavor(sections)).toBe("modulating");
  });

  it("treats an empty section list as single-key", () => {
    expect(getChordFlavor([])).toBe("single-key");
  });
});

describe("extractFeatures", () => {
  it("combines all four features into one object", () => {
    const result = extractFeatures(
      { key: 2, mode: 0, tempo: 128 },
      [
        { key: 2, mode: 0 },
        { key: 2, mode: 0 },
        { key: 2, mode: 0 },
      ]
    );

    expect(result).toEqual({
      key_mode: "D Minor",
      bpm_range: "120-139",
      song_structure: "compact",
      chord_flavor: "single-key",
    });
  });
});
