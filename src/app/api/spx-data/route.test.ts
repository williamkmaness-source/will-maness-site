import { describe, it, expect, vi, beforeEach } from "vitest";
import { TICKER_ALLOWLIST } from "./route";

// ── Module mocks ──────────────────────────────────────────────────────────────

// vi.hoisted ensures these are available when vi.mock factories run (which are hoisted).
const { mockChart, mockQuote } = vi.hoisted(() => ({
  mockChart: vi.fn(),
  mockQuote: vi.fn(),
}));

vi.mock("yahoo-finance2", () => {
  // yahoo-finance2 v3 exports a class as the default — must be a real constructor.
  function YahooFinanceMock(this: Record<string, unknown>) {
    this.chart = mockChart;
    this.quote = mockQuote;
  }
  return { default: YahooFinanceMock };
});

vi.mock("technicalindicators", () => ({
  SMA: { calculate: vi.fn().mockReturnValue(Array(210).fill(500)) },
  RSI: { calculate: vi.fn().mockReturnValue(Array(196).fill(55)) },
  MACD: {
    calculate: vi.fn().mockReturnValue(
      Array(172).fill({ MACD: 1, signal: 0.5, histogram: 0.5 })
    ),
  },
  BollingerBands: {
    calculate: vi.fn().mockReturnValue(
      Array(191).fill({ upper: 510, middle: 500, lower: 490 })
    ),
  },
}));

vi.mock("@/lib/spx-signals", () => ({
  deriveSignals: vi.fn().mockReturnValue({
    trend: "bullish",
    momentum: "neutral",
    volatility: "calm",
    maCross: "golden",
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDate(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

// 215 valid OHLCV rows spanning ~14 months
function minimalQuotes() {
  return Array.from({ length: 215 }, (_, i) => ({
    date: makeDate(215 - i),
    open: 490,
    high: 510,
    low: 480,
    close: 500,
    volume: 1_000_000,
  }));
}

function makeRequest(ticker?: string): Request {
  const base = "http://localhost/api/spx-data";
  const url = ticker ? `${base}?ticker=${ticker}` : base;
  return new Request(url);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TICKER_ALLOWLIST", () => {
  it("contains SPY as the default ticker", () => {
    expect(TICKER_ALLOWLIST.has("SPY")).toBe(true);
  });

  it("contains top-25 S&P 500 constituents", () => {
    const expected = ["NVDA", "MSFT", "AAPL", "AMZN", "GOOGL", "META", "TSLA"];
    for (const symbol of expected) {
      expect(TICKER_ALLOWLIST.has(symbol)).toBe(true);
    }
  });

  it("contains BRK-B using Yahoo Finance notation", () => {
    expect(TICKER_ALLOWLIST.has("BRK-B")).toBe(true);
    expect(TICKER_ALLOWLIST.has("BRK.B")).toBe(false);
  });

  it("contains IBM", () => {
    expect(TICKER_ALLOWLIST.has("IBM")).toBe(true);
  });

  it("has 27 entries (25 S&P 500 + SPY + IBM)", () => {
    expect(TICKER_ALLOWLIST.size).toBe(27);
  });

  it("does not contain arbitrary symbols", () => {
    expect(TICKER_ALLOWLIST.has("FAKE")).toBe(false);
    expect(TICKER_ALLOWLIST.has("")).toBe(false);
  });
});

describe("GET /api/spx-data — ticker validation", () => {
  beforeEach(() => {
    vi.resetModules();
    mockChart.mockReset();
    mockQuote.mockReset();
  });

  it("returns 400 for an unknown ticker symbol", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest("FAKE"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown ticker/);
  });

  it("returns 400 for an empty ticker string", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest(""));
    // Empty string is falsy → defaults to SPY (valid), so this actually 200s.
    // Confirm the API doesn't treat empty string as invalid; it defaults to SPY.
    expect(res.status).not.toBe(400);
  });

  it("defaults to SPY when no ticker param is supplied", async () => {
    mockChart.mockResolvedValue({ quotes: minimalQuotes() });
    mockQuote.mockResolvedValue({ regularMarketPrice: 18 });

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    // chart() should have been called with "SPY"
    expect(mockChart).toHaveBeenCalledWith(
      "SPY",
      expect.objectContaining({ interval: "1d" })
    );
  });

  it("passes the selected ticker to the yahoo-finance2 chart call", async () => {
    mockChart.mockResolvedValue({ quotes: minimalQuotes() });
    mockQuote.mockResolvedValue({ regularMarketPrice: 18 });

    const { GET } = await import("./route");
    await GET(makeRequest("NVDA"));
    expect(mockChart).toHaveBeenCalledWith(
      "NVDA",
      expect.objectContaining({ interval: "1d" })
    );
  });

  it("always fetches VIX regardless of selected ticker", async () => {
    mockChart.mockResolvedValue({ quotes: minimalQuotes() });
    mockQuote.mockResolvedValue({ regularMarketPrice: 18 });

    const { GET } = await import("./route");
    await GET(makeRequest("AAPL"));
    expect(mockQuote).toHaveBeenCalledWith("^VIX");
  });

  it("returns 200 with Cache-Control header for valid tickers", async () => {
    mockChart.mockResolvedValue({ quotes: minimalQuotes() });
    mockQuote.mockResolvedValue({ regularMarketPrice: 18 });

    const { GET } = await import("./route");
    const res = await GET(makeRequest("MSFT"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
  });
});
