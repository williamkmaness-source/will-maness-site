import { describe, it, expect } from "vitest";
import { deriveSignals } from "@/lib/spx-signals";
import type { SpxIndicators } from "@/lib/spx-types";

const base: SpxIndicators = {
  lastClose: 500,
  lastSma200: 480,
  lastSma50: 495,
  lastRsi: 50,
  vix: 18,
};

describe("deriveSignals — trend", () => {
  it("returns bullish when price is above sma200", () => {
    expect(deriveSignals({ ...base, lastClose: 500, lastSma200: 480 }).trend).toBe("bullish");
  });
  it("returns bearish when price is below sma200", () => {
    expect(deriveSignals({ ...base, lastClose: 460, lastSma200: 480 }).trend).toBe("bearish");
  });
  it("returns neutral when price equals sma200", () => {
    expect(deriveSignals({ ...base, lastClose: 480, lastSma200: 480 }).trend).toBe("neutral");
  });
});

describe("deriveSignals — momentum", () => {
  it("returns overbought when RSI > 70", () => {
    expect(deriveSignals({ ...base, lastRsi: 74 }).momentum).toBe("overbought");
  });
  it("returns overbought at RSI exactly 71", () => {
    expect(deriveSignals({ ...base, lastRsi: 71 }).momentum).toBe("overbought");
  });
  it("returns oversold when RSI < 30", () => {
    expect(deriveSignals({ ...base, lastRsi: 28 }).momentum).toBe("oversold");
  });
  it("returns oversold at RSI exactly 29", () => {
    expect(deriveSignals({ ...base, lastRsi: 29 }).momentum).toBe("oversold");
  });
  it("returns neutral when RSI is between 30 and 70", () => {
    expect(deriveSignals({ ...base, lastRsi: 55 }).momentum).toBe("neutral");
  });
  it("returns neutral at RSI boundary 70", () => {
    expect(deriveSignals({ ...base, lastRsi: 70 }).momentum).toBe("neutral");
  });
  it("returns neutral at RSI boundary 30", () => {
    expect(deriveSignals({ ...base, lastRsi: 30 }).momentum).toBe("neutral");
  });
});

describe("deriveSignals — volatility", () => {
  it("returns calm when VIX < 20", () => {
    expect(deriveSignals({ ...base, vix: 15 }).volatility).toBe("calm");
  });
  it("returns calm at VIX exactly 19", () => {
    expect(deriveSignals({ ...base, vix: 19 }).volatility).toBe("calm");
  });
  it("returns elevated when VIX is 20–30", () => {
    expect(deriveSignals({ ...base, vix: 25 }).volatility).toBe("elevated");
  });
  it("returns elevated at VIX exactly 20", () => {
    expect(deriveSignals({ ...base, vix: 20 }).volatility).toBe("elevated");
  });
  it("returns elevated at VIX exactly 30", () => {
    expect(deriveSignals({ ...base, vix: 30 }).volatility).toBe("elevated");
  });
  it("returns fear when VIX > 30", () => {
    expect(deriveSignals({ ...base, vix: 35 }).volatility).toBe("fear");
  });
});

describe("deriveSignals — maCross", () => {
  it("returns golden when sma50 > sma200", () => {
    expect(deriveSignals({ ...base, lastSma50: 495, lastSma200: 480 }).maCross).toBe("golden");
  });
  it("returns death when sma50 < sma200", () => {
    expect(deriveSignals({ ...base, lastSma50: 460, lastSma200: 480 }).maCross).toBe("death");
  });
  it("returns none when sma50 equals sma200", () => {
    expect(deriveSignals({ ...base, lastSma50: 480, lastSma200: 480 }).maCross).toBe("none");
  });
});
