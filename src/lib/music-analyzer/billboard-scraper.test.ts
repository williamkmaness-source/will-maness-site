// Tests for the music-analyzer Billboard scraper (issue #215).
// Static markup fixtures and an injected fetch — no network calls.

import { describe, it, expect, vi } from "vitest";
import {
  decodeEntities,
  stripTags,
  parseHot100,
  fetchHot100,
  HOT_100_URL,
} from "./billboard-scraper";

// Mirrors the real chart page's row markup: rank as the first .c-label span, title in an <h3>,
// artist in the .c-label span that follows the title (usually wrapped in an <a>).
function row(rank: number, title: string, artist: string, artistLink = true): string {
  const artistInner = artistLink
    ? `<a href="https://www.billboard.com/artist/slug/">${artist}</a>`
    : artist;

  return `
<ul class="o-chart-results-list-row // lrv-a-unstyle-list lrv-u-flex" data-detail-target="${rank}" data-ajax="">
  <li class="o-chart-results-list__item // lrv-u-color-black">
    <span class="c-label  a-font-basic u-font-size-33@desktop" >

  ${rank}
</span>
  </li>
  <li class="o-chart-results-list__item // u-width-200">
    <h3 id="title-of-a-story" class="c-title  a-font-basic u-letter-spacing-0010">${title}</h3>
    <span class="
      c-label a-no-trucate
      a-font-secondary u-font-size-15
    ">${artistInner}</span>
  </li>
  <li class="o-chart-results-list__item // a-chart-bg-color">
    <span class="c-label  u-font-family-basic@tablet">${rank}</span>
    <span class="c-label  u-font-family-basic@tablet">39</span>
  </li>
</ul>`;
}

function page(...rows: string[]): string {
  return `<html><body><div class="chart-results-list">${rows.join("\n")}</div></body></html>`;
}

describe("decodeEntities", () => {
  it("decodes the numeric entities Billboard emits in titles", () => {
    expect(decodeEntities("Choosin&#039; Texas")).toBe("Choosin' Texas");
    expect(decodeEntities("Rock &#38; Roll")).toBe("Rock & Roll");
  });

  it("decodes hex numeric entities", () => {
    expect(decodeEntities("Don&#x27;t Stop")).toBe("Don't Stop");
  });

  it("decodes the common named entities", () => {
    expect(decodeEntities("Tame Impala &amp; JENNIE")).toBe("Tame Impala & JENNIE");
    expect(decodeEntities("&quot;Hello&quot;")).toBe('"Hello"');
    expect(decodeEntities("Wait&hellip;")).toBe("Wait…");
  });

  it("leaves unknown entities untouched rather than dropping characters", () => {
    expect(decodeEntities("a &notarealentity; b")).toBe("a &notarealentity; b");
  });

  it("leaves an out-of-range numeric entity intact instead of throwing", () => {
    // String.fromCodePoint throws RangeError above U+10FFFF; malformed markup must not kill the scrape.
    expect(decodeEntities("Song &#1114112; Title")).toBe("Song &#1114112; Title");
    expect(decodeEntities("Song &#xFFFFFFFF; Title")).toBe("Song &#xFFFFFFFF; Title");
  });

  it("still decodes the highest valid code point", () => {
    expect(decodeEntities("&#x10FFFF;")).toBe(String.fromCodePoint(0x10ffff));
  });
});

describe("stripTags", () => {
  it("drops markup, decodes entities, and collapses whitespace", () => {
    expect(stripTags('\n\t<a href="/x">Ella  Langley</a>\n')).toBe("Ella Langley");
    expect(stripTags("<span>Rock &#38;\n Roll</span>")).toBe("Rock & Roll");
  });

  it("returns an empty string for markup with no visible text", () => {
    expect(stripTags("<span></span>")).toBe("");
  });
});

describe("parseHot100", () => {
  it("parses rank, title, and artist from each chart row", () => {
    const html = page(
      row(1, "Choosin&#039; Texas", "Ella Langley"),
      row(2, "I Knew It, I Knew You", "Taylor Swift"),
      row(3, "Dracula", "Tame Impala &amp; JENNIE")
    );

    expect(parseHot100(html)).toEqual([
      { rank: 1, title: "Choosin' Texas", artist: "Ella Langley" },
      { rank: 2, title: "I Knew It, I Knew You", artist: "Taylor Swift" },
      { rank: 3, title: "Dracula", artist: "Tame Impala & JENNIE" },
    ]);
  });

  it("handles an artist rendered as plain text instead of a link", () => {
    expect(parseHot100(page(row(7, "Swim", "BTS", false)))).toEqual([
      { rank: 7, title: "Swim", artist: "BTS" },
    ]);
  });

  it("preserves document order and does not assume rank equals position", () => {
    const html = page(row(4, "Four", "D"), row(9, "Nine", "N"));
    expect(parseHot100(html).map((e) => e.rank)).toEqual([4, 9]);
  });

  it("falls back to document position when the rank label is missing", () => {
    const html = page(row(1, "One", "A"), row(2, "Two", "B")).replace(
      /<span class="c-label  a-font-basic u-font-size-33@desktop" >[\s\S]*?<\/span>/,
      ""
    );
    // First row lost its rank span; its position (1) is used and the artist still resolves.
    expect(parseHot100(html)[0]).toEqual({ rank: 1, title: "One", artist: "A" });
  });

  it("skips a row with no title rather than emitting a half-populated entry", () => {
    const html = page(row(1, "One", "A"), row(2, "Two", "B")).replace(
      /<h3[^>]*>Two<\/h3>/,
      ""
    );
    expect(parseHot100(html)).toEqual([{ rank: 1, title: "One", artist: "A" }]);
  });

  it("returns an empty array when the markup has no chart rows", () => {
    expect(parseHot100("<html><body><p>Nothing here</p></body></html>")).toEqual([]);
  });

  it("is not affected by regex state across successive calls", () => {
    const html = page(row(1, "One", "A"), row(2, "Two", "B"));
    expect(parseHot100(html)).toEqual(parseHot100(html));
  });
});

describe("fetchHot100", () => {
  it("requests the chart page and returns the parsed entries", async () => {
    const html = page(row(1, "One", "A"));
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(html),
    });

    await expect(fetchHot100(fetchImpl as unknown as typeof fetch)).resolves.toEqual([
      { rank: 1, title: "One", artist: "A" },
    ]);
    expect(fetchImpl.mock.calls[0][0]).toBe(HOT_100_URL);
  });

  it("throws on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(""),
    });

    await expect(fetchHot100(fetchImpl as unknown as typeof fetch)).rejects.toThrow("HTTP 503");
  });

  it("throws a markup-change error rather than silently reporting an empty chart", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("<html><body>redesigned</body></html>"),
    });

    await expect(fetchHot100(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      /markup has likely changed/
    );
  });
});
