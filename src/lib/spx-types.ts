// spx-types.ts — Shared TypeScript types for the SPX technical analysis dashboard.
// These types form the contract between the API route and all client components.
// All time values are ISO date strings ("YYYY-MM-DD").

export type SpxCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type SpxSeries = {
  time: string;
  value: number;
};

export type SpxMacd = {
  macd: SpxSeries[];
  signal: SpxSeries[];
  histogram: SpxSeries[];
};

export type SpxSignals = {
  trend: "bullish" | "bearish" | "neutral";
  momentum: "overbought" | "oversold" | "neutral";
  volatility: "calm" | "elevated" | "fear";
  maCross: "golden" | "death" | "none";
};

export type SpxIndicators = {
  lastClose: number;
  lastSma200: number;
  lastSma50: number;
  lastRsi: number;
  vix: number;
};

export type SpxData = {
  candles: SpxCandle[];
  volume: SpxSeries[];
  sma20: SpxSeries[];
  sma50: SpxSeries[];
  sma200: SpxSeries[];
  rsi: SpxSeries[];
  macd: SpxMacd;
  vix: number;
  goldenCross: boolean;
  signals: SpxSignals;
};
