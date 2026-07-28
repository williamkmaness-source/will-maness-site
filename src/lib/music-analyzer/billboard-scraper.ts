// billboard-scraper.ts — Scrapes the public Billboard Hot 100 chart page into a ranked track list (issue #215).
// Stateless: no DB dependency, no credentials. Billboard publishes no public API, so `parseHot100`
// targets the chart page's markup — if Billboard changes its layout, that one function is the fix site.

export interface BillboardEntry {
  rank: number;
  title: string;
  artist: string;
}

export const HOT_100_URL = "https://www.billboard.com/charts/hot-100/";
export const HOT_100_SIZE = 100;

const USER_AGENT =
  "music-analyzer-bot/1.0 (github.com/williamkmaness-source/will-maness-site)";
const FETCH_TIMEOUT_MS = 30_000;

// Each chart position is one <ul class="o-chart-results-list-row ...">…</ul> block.
const ROW_PATTERN = /<ul class="o-chart-results-list-row[\s\S]*?<\/ul>/g;
// Within a row: the title is the first <h3>, the rank is the first digits-only .c-label span,
// and the artist is the first .c-label span that follows the title.
const TITLE_PATTERN = /<h3[^>]*>([\s\S]*?)<\/h3>/;
const LABEL_PATTERN = /<span class="[^"]*c-label[^"]*"[^>]*>([\s\S]*?)<\/span>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** Decode the HTML entities Billboard emits in titles and artist names (e.g. `Choosin&#039; Texas`). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Reduce an HTML fragment to its visible text: drop tags, decode entities, collapse whitespace. */
export function stripTags(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse the Hot 100 chart page into ranked entries.
 *
 * Rows are returned in document order. A row missing a title or an artist is skipped rather than
 * emitted half-populated; the rank falls back to document position when the rank label is absent,
 * so a single markup change degrades to fewer rows instead of silently misranked ones.
 */
export function parseHot100(html: string): BillboardEntry[] {
  const entries: BillboardEntry[] = [];
  const rows = html.match(ROW_PATTERN) ?? [];

  rows.forEach((row, index) => {
    const titleMatch = TITLE_PATTERN.exec(row);
    if (!titleMatch) return;

    const title = stripTags(titleMatch[1]);
    if (!title) return;

    // Walk every .c-label span once: the first digits-only one is the rank, and the first one
    // starting after the title block is the artist.
    let rank: number | null = null;
    let artist: string | null = null;

    LABEL_PATTERN.lastIndex = 0;
    let label: RegExpExecArray | null;
    while ((label = LABEL_PATTERN.exec(row)) !== null) {
      const text = stripTags(label[1]);
      if (rank === null && /^\d+$/.test(text)) {
        rank = Number(text);
        continue;
      }
      if (artist === null && label.index > titleMatch.index && text) {
        artist = text;
      }
      if (rank !== null && artist !== null) break;
    }

    if (!artist) return;
    entries.push({ rank: rank ?? index + 1, title, artist });
  });

  return entries;
}

/** Fetch and parse the current Hot 100. `fetchImpl` is injectable so tests never touch the network. */
export async function fetchHot100(
  fetchImpl: typeof fetch = fetch
): Promise<BillboardEntry[]> {
  const res = await fetchImpl(HOT_100_URL, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${HOT_100_URL}`);
  }

  const entries = parseHot100(await res.text());

  if (entries.length === 0) {
    throw new Error(
      "Billboard Hot 100 parse returned 0 entries — the chart page markup has likely changed"
    );
  }

  return entries;
}
