"use client";

import { useEffect, useState } from "react";
import { SpxChart, type TimeRange, type SmaKey } from "./SpxChart";
import { SpxIndicatorPanels } from "./SpxIndicatorPanels";
import type { SpxData, SpxSignals } from "@/lib/spx-types";
import { colors, fontFamilies } from "@/lib/tokens";

// ── Signal chip config ───────────────────────────────────────────────────────

type SignalColor = { bg: string; text: string; border: string };

const CHIP_COLORS: Record<string, SignalColor> = {
  bullish:    { bg: "#EBF5EF", text: "#2A6048", border: "#A8D5BA" },
  golden:     { bg: "#EBF5EF", text: "#2A6048", border: "#A8D5BA" },
  calm:       { bg: "#EBF5EF", text: "#2A6048", border: "#A8D5BA" },
  oversold:   { bg: "#EBF5EF", text: "#2A6048", border: "#A8D5BA" },
  bearish:    { bg: "#FAE8E0", text: "#8B3A1E", border: "#E8A88A" },
  death:      { bg: "#FAE8E0", text: "#8B3A1E", border: "#E8A88A" },
  fear:       { bg: "#FAE8E0", text: "#8B3A1E", border: "#E8A88A" },
  overbought: { bg: "#FAE8E0", text: "#8B3A1E", border: "#E8A88A" },
  elevated:   { bg: "#FBF1E4", text: "#7A4E1A", border: "#E8C98A" },
  neutral:    { bg: colors.bgSoft, text: colors.muted, border: colors.line },
  none:       { bg: colors.bgSoft, text: colors.muted, border: colors.line },
};

const CHIP_LABELS: Partial<Record<keyof SpxSignals, string>> = {
  trend:      "Trend",
  momentum:   "Momentum",
  volatility: "Volatility",
  maCross:    "MA Cross",
};

const CHIP_VALUES: Record<string, string> = {
  bullish: "Bullish", bearish: "Bearish", neutral: "Neutral",
  overbought: "Overbought", oversold: "Oversold",
  calm: "Calm", elevated: "Elevated", fear: "Fear",
  golden: "Golden Cross", death: "Death Cross", none: "No Cross",
};

const TIME_RANGES: TimeRange[] = ["3M", "6M", "1Y"];

// Top 25 S&P 500 constituents by market cap (as of 2026-06) + IBM. SPY is the default.
const TICKER_OPTIONS = [
  { label: "S&P 500 (SPY)", symbol: "SPY" },
  { label: "NVDA · Nvidia",          symbol: "NVDA" },
  { label: "MSFT · Microsoft",       symbol: "MSFT" },
  { label: "AAPL · Apple",           symbol: "AAPL" },
  { label: "AMZN · Amazon",          symbol: "AMZN" },
  { label: "GOOGL · Alphabet",       symbol: "GOOGL" },
  { label: "META · Meta",            symbol: "META" },
  { label: "TSLA · Tesla",           symbol: "TSLA" },
  { label: "AVGO · Broadcom",        symbol: "AVGO" },
  { label: "BRK-B · Berkshire",      symbol: "BRK-B" },
  { label: "JPM · JPMorgan",         symbol: "JPM" },
  { label: "LLY · Eli Lilly",        symbol: "LLY" },
  { label: "V · Visa",               symbol: "V" },
  { label: "UNH · UnitedHealth",     symbol: "UNH" },
  { label: "XOM · ExxonMobil",       symbol: "XOM" },
  { label: "COST · Costco",          symbol: "COST" },
  { label: "MA · Mastercard",        symbol: "MA" },
  { label: "NFLX · Netflix",         symbol: "NFLX" },
  { label: "HD · Home Depot",        symbol: "HD" },
  { label: "PG · Procter & Gamble",  symbol: "PG" },
  { label: "ORCL · Oracle",          symbol: "ORCL" },
  { label: "JNJ · Johnson & Johnson",symbol: "JNJ" },
  { label: "BAC · Bank of America",  symbol: "BAC" },
  { label: "WMT · Walmart",          symbol: "WMT" },
  { label: "ABBV · AbbVie",          symbol: "ABBV" },
  { label: "CRM · Salesforce",       symbol: "CRM" },
  { label: "IBM",                     symbol: "IBM" },
];

function vixZone(vix: number): string {
  if (vix < 20) return "Calm";
  if (vix <= 30) return "Elevated";
  return "Fear";
}
function vixZoneColor(vix: number): string {
  if (vix < 20) return "#2A6048";
  if (vix <= 30) return "#7A4E1A";
  return "#8B3A1E";
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-[16px]">
      <div className="flex gap-[8px] flex-wrap">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[28px] w-[110px] rounded-[4px] bg-line animate-pulse" />
        ))}
      </div>
      <div className="flex gap-[12px]">
        <div className="h-[72px] flex-1 rounded-[4px] bg-line animate-pulse" />
        <div className="h-[72px] flex-1 rounded-[4px] bg-line animate-pulse" />
      </div>
      <div className="h-[340px] rounded-[4px] bg-line animate-pulse" />
      <div className="h-[220px] rounded-[4px] bg-line animate-pulse" />
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function SpxDashboard() {
  const [ticker, setTicker] = useState("SPY");
  const [data, setData] = useState<SpxData | null>(null);
  const [error, setError] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  const [smaToggles, setSmaToggles] = useState({ sma20: true, sma50: true, sma200: true });
  const [showBB, setShowBB] = useState(true);

  useEffect(() => {
    fetch(`/api/spx-data?ticker=${ticker}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [ticker]);

  function handleToggleSma(key: SmaKey) {
    setSmaToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (error) {
    return (
      <p className="font-mono text-[12px] text-hint py-[24px]">
        Market data unavailable — try again later.
      </p>
    );
  }

  if (!data) return <Skeleton />;

  const { signals, vix, goldenCross, candles, volume, sma20, sma50, sma200, rsi, macd, bollingerBands } = data;
  const lastCandle = candles[candles.length - 1];
  const lastClose = lastCandle?.close ?? 0;

  return (
    <div className="space-y-[20px]">
      {/* Ticker selector */}
      <div>
        <select
          value={ticker}
          onChange={(e) => {
            setData(null);
            setError(false);
            setTicker(e.target.value);
          }}
          className="font-mono text-[12px] px-[10px] py-[6px] rounded-[4px] border cursor-pointer"
          style={{
            borderColor: colors.line,
            background: colors.bgSoft,
            color: colors.ink,
            fontFamily: fontFamilies.mono,
          }}
        >
          {TICKER_OPTIONS.map((opt) => (
            <option key={opt.symbol} value={opt.symbol}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Signal summary chips */}
      <div className="flex gap-[6px] flex-wrap">
        {(Object.keys(CHIP_LABELS) as (keyof SpxSignals)[]).map((key) => {
          const val = signals[key];
          const c = CHIP_COLORS[val] ?? CHIP_COLORS.neutral;
          return (
            <div
              key={key}
              className="inline-flex flex-col px-[10px] py-[5px] rounded-[4px] border"
              style={{ background: c.bg, borderColor: c.border }}
            >
              <span
                className="font-mono uppercase tracking-[0.06em]"
                style={{ fontSize: 10, color: colors.hint, fontFamily: fontFamilies.mono }}
              >
                {CHIP_LABELS[key]}
              </span>
              <span
                className="font-mono font-medium"
                style={{ fontSize: 12, color: c.text, fontFamily: fontFamilies.mono }}
              >
                {CHIP_VALUES[val] ?? val}
              </span>
            </div>
          );
        })}
      </div>

      {/* Context cards */}
      <div className="grid grid-cols-2 gap-[12px]">
        {/* VIX card */}
        <div
          className="rounded-[4px] border px-[16px] py-[12px]"
          style={{ borderColor: colors.line, background: colors.bgSoft }}
        >
          <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[4px]">
            VIX · Volatility Index
          </p>
          <p className="font-mono text-[22px] font-medium text-ink leading-none mb-[3px]">
            {vix.toFixed(2)}
          </p>
          <p
            className="font-mono text-[11px] font-medium"
            style={{ color: vixZoneColor(vix) }}
          >
            {vixZone(vix)}
          </p>
        </div>

        {/* MA Cross card */}
        <div
          className="rounded-[4px] border px-[16px] py-[12px]"
          style={{ borderColor: colors.line, background: colors.bgSoft }}
        >
          <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[4px]">
            50 / 200 SMA
          </p>
          <p
            className="font-mono text-[16px] font-medium leading-snug mb-[3px]"
            style={{ color: goldenCross ? "#2A6048" : colors.clay }}
          >
            {goldenCross ? "Golden Cross" : "Death Cross"}
          </p>
          <p className="font-mono text-[11px] text-muted">
            {ticker} last close <span className="text-ink">${lastClose.toFixed(2)}</span>
          </p>
        </div>
      </div>

      {/* Time range controls */}
      <div className="flex gap-[6px]">
        {TIME_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setTimeRange(r)}
            className="px-[10px] py-[3px] rounded-[3px] font-mono text-[11px] tracking-[0.04em] border cursor-pointer transition-colors"
            style={{
              borderColor: timeRange === r ? colors.inkSoft : colors.line,
              color: timeRange === r ? colors.ink : colors.hint,
              backgroundColor: timeRange === r ? colors.bgCode : "transparent",
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Price chart */}
      <SpxChart
        candles={candles}
        volume={volume}
        sma20={sma20}
        sma50={sma50}
        sma200={sma200}
        bollingerBands={bollingerBands}
        showSma20={smaToggles.sma20}
        showSma50={smaToggles.sma50}
        showSma200={smaToggles.sma200}
        showBB={showBB}
        timeRange={timeRange}
        onToggleSma={handleToggleSma}
        onToggleBB={() => setShowBB((prev) => !prev)}
      />

      {/* RSI + MACD panels */}
      <SpxIndicatorPanels rsi={rsi} macd={macd} />
    </div>
  );
}
