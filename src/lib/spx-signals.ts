import type { SpxIndicators, SpxSignals } from "@/lib/spx-types";

export function deriveSignals(indicators: SpxIndicators): SpxSignals {
  const { lastClose, lastSma200, lastSma50, lastRsi, vix } = indicators;

  const trend: SpxSignals["trend"] =
    lastClose > lastSma200 ? "bullish" :
    lastClose < lastSma200 ? "bearish" :
    "neutral";

  const momentum: SpxSignals["momentum"] =
    lastRsi > 70 ? "overbought" :
    lastRsi < 30 ? "oversold" :
    "neutral";

  const volatility: SpxSignals["volatility"] =
    vix < 20  ? "calm" :
    vix <= 30 ? "elevated" :
    "fear";

  const maCross: SpxSignals["maCross"] =
    lastSma50 > lastSma200 ? "golden" :
    lastSma50 < lastSma200 ? "death" :
    "none";

  return { trend, momentum, volatility, maCross };
}
