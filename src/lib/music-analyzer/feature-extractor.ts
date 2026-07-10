// feature-extractor.ts — Pure functions that normalize raw Spotify audio data into four song features (issue #214).
// No side effects, no DB or network dependencies.

export interface AudioFeatures {
  key: number; // 0–11 pitch class
  mode: number; // 0 = minor, 1 = major
  tempo: number; // BPM
}

export interface AudioAnalysisSection {
  key: number;
  mode: number;
}

export type SongStructure = "compact" | "standard" | "extended";
export type ChordFlavor = "single-key" | "modal-shift" | "modulating";

export interface ExtractedFeatures {
  key_mode: string;
  bpm_range: string;
  song_structure: SongStructure;
  chord_flavor: ChordFlavor;
}

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// A section's key/mode dominates the chord flavor call when it covers this share of sections.
const DOMINANT_KEY_RATIO = 0.6;

export function getKeyMode(features: Pick<AudioFeatures, "key" | "mode">): string {
  const keyName = KEY_NAMES[features.key] ?? "Unknown";
  const modeName = features.mode === 1 ? "Major" : "Minor";
  return `${keyName} ${modeName}`;
}

export function getBpmRange(tempo: number): string {
  if (tempo < 60) return "<60";
  if (tempo < 80) return "60-79";
  if (tempo < 100) return "80-99";
  if (tempo < 120) return "100-119";
  if (tempo < 140) return "120-139";
  return "140+";
}

export function getSongStructure(sectionCount: number): SongStructure {
  if (sectionCount <= 4) return "compact";
  if (sectionCount <= 7) return "standard";
  return "extended";
}

export function getChordFlavor(sections: AudioAnalysisSection[]): ChordFlavor {
  if (sections.length === 0) return "single-key";

  const counts = new Map<number, number>();
  for (const section of sections) {
    counts.set(section.key, (counts.get(section.key) ?? 0) + 1);
  }

  if (counts.size === 1) return "single-key";

  const majorityCount = Math.max(...counts.values());
  const majorityRatio = majorityCount / sections.length;

  return majorityRatio >= DOMINANT_KEY_RATIO ? "modal-shift" : "modulating";
}

export function extractFeatures(
  audioFeatures: AudioFeatures,
  sections: AudioAnalysisSection[]
): ExtractedFeatures {
  return {
    key_mode: getKeyMode(audioFeatures),
    bpm_range: getBpmRange(audioFeatures.tempo),
    song_structure: getSongStructure(sections.length),
    chord_flavor: getChordFlavor(sections),
  };
}
