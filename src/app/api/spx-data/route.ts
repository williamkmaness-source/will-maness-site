// route.ts — SPX Technical Analysis data API.
// Fetches ~14 months of SPY OHLC + current ^VIX via yahoo-finance2,
// computes SMA 20/50/200, RSI(14), MACD(12-26-9) server-side,
// and returns a single pre-typed SpxData response cached for 24 hours.

export const dynamic = "force-dynamic";

// yahoo-finance2 v3: default export is the class, not a singleton instance.
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});
import { SMA, RSI, MACD, BollingerBands } from "technicalindicators";
import { deriveSignals } from "@/lib/spx-signals";
import type { SpxData, SpxCandle, SpxSeries } from "@/lib/spx-types";

const CACHE_HEADER = "s-maxage=86400, stale-while-revalidate";

// Minimal local interfaces for the yahoo-finance2 responses we use.
// The package's exports map omits a `types` condition so TypeScript resolves
// the default import as `never` under moduleResolution:"bundler". Casting
// through these interfaces is safer than `as any`.
type YfChartRow = {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};
type YfChartResult = { quotes: YfChartRow[] };
type YfQuote = { regularMarketPrice?: number | null };

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function alignedSeries(dates: string[], values: number[]): SpxSeries[] {
  const offset = dates.length - values.length;
  return values.map((value, i) => ({ time: dates[offset + i], value }));
}

export async function GET() {
  try {
    // Fetch ~14 months to guarantee 200+ trading days for SMA(200)
    const period1 = new Date(Date.now() - 420 * 24 * 60 * 60 * 1000);
    const period2 = new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = yahooFinance as any;
    const [chartRaw, vixQuoteRaw]: [YfChartResult, YfQuote] = await Promise.all([
      yf.chart("SPY", { period1, period2, interval: "1d" }),
      yf.quote("^VIX"),
    ]);
    const quotesRaw = chartRaw.quotes;

    type ValidQuote = Omit<YfChartRow, "open" | "high" | "low" | "close" | "volume"> & {
      open: number; high: number; low: number; close: number; volume: number;
    };
    const sorted: ValidQuote[] = quotesRaw
      .filter(
        (q): q is ValidQuote =>
          q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const vixQuote = vixQuoteRaw;

    if (sorted.length < 210) {
      return Response.json({ error: "Insufficient historical data" }, { status: 503 });
    }

    const dates = sorted.map((q) => toIsoDate(q.date));
    const closes = sorted.map((q) => q.close);

    const candles: SpxCandle[] = sorted.map((q) => ({
      time: toIsoDate(q.date),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
    }));

    const volume: SpxSeries[] = sorted.map((q) => ({
      time: toIsoDate(q.date),
      value: q.volume,
    }));

    const sma20  = alignedSeries(dates, SMA.calculate({ period: 20,  values: closes }));
    const sma50  = alignedSeries(dates, SMA.calculate({ period: 50,  values: closes }));
    const sma200 = alignedSeries(dates, SMA.calculate({ period: 200, values: closes }));
    const rsi    = alignedSeries(dates, RSI.calculate({ period: 14,  values: closes }));

    const macdRaw = MACD.calculate({
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      values: closes,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    const macdOffset = dates.length - macdRaw.length;
    const macdData: SpxData["macd"] = { macd: [], signal: [], histogram: [] };
    macdRaw.forEach((m, i) => {
      if (m.MACD == null || m.signal == null || m.histogram == null) return;
      const time = dates[macdOffset + i];
      macdData.macd.push({ time, value: m.MACD });
      macdData.signal.push({ time, value: m.signal });
      macdData.histogram.push({ time, value: m.histogram });
    });

    const bbRaw = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    const bollingerBands = {
      upper:  alignedSeries(dates, bbRaw.map((b) => b.upper)),
      middle: alignedSeries(dates, bbRaw.map((b) => b.middle)),
      lower:  alignedSeries(dates, bbRaw.map((b) => b.lower)),
    };

    const lastClose  = closes[closes.length - 1];
    const lastSma200 = sma200[sma200.length - 1]?.value ?? lastClose;
    const lastSma50  = sma50[sma50.length - 1]?.value ?? lastClose;
    const lastRsi    = rsi[rsi.length - 1]?.value ?? 50;
    const vix        = vixQuote.regularMarketPrice ?? 20;

    const signals = deriveSignals({ lastClose, lastSma200, lastSma50, lastRsi, vix });

    const data: SpxData = {
      candles,
      volume,
      sma20,
      sma50,
      sma200,
      rsi,
      macd: macdData,
      bollingerBands,
      vix,
      goldenCross: lastSma50 > lastSma200,
      signals,
    };

    return Response.json(data, { headers: { "Cache-Control": CACHE_HEADER } });
  } catch (err) {
    console.error("[spx-data]", err);
    return Response.json({ error: "Failed to fetch market data" }, { status: 503 });
  }
}
