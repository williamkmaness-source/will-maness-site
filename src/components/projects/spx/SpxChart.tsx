"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import type { SpxCandle, SpxSeries } from "@/lib/spx-types";
import { colors, fontFamilies } from "@/lib/tokens";

export type TimeRange = "3M" | "6M" | "1Y";
export type SmaKey = "sma20" | "sma50" | "sma200";

type Props = {
  candles: SpxCandle[];
  volume: SpxSeries[];
  sma20: SpxSeries[];
  sma50: SpxSeries[];
  sma200: SpxSeries[];
  showSma20: boolean;
  showSma50: boolean;
  showSma200: boolean;
  timeRange: TimeRange;
  onToggleSma: (key: SmaKey) => void;
};

const UP_COLOR = "#3A7D5A";
const DOWN_COLOR = colors.clay;

const SMA_META: { key: SmaKey; label: string; color: string; width: 1 | 2 }[] = [
  { key: "sma20",  label: "SMA 20",  color: colors.muted,  width: 1 },
  { key: "sma50",  label: "SMA 50",  color: colors.clay,   width: 1 },
  { key: "sma200", label: "SMA 200", color: colors.accent,  width: 2 },
];

function getVisibleRange(candles: SpxCandle[], range: TimeRange) {
  if (!candles.length) return undefined;
  const to = candles[candles.length - 1].time;
  const count = range === "3M" ? 63 : range === "6M" ? 126 : candles.length;
  const from = candles[Math.max(0, candles.length - count)].time;
  return { from, to };
}

export function SpxChart({
  candles,
  volume,
  sma20,
  sma50,
  sma200,
  showSma20,
  showSma50,
  showSma200,
  timeRange,
  onToggleSma,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const smaSeries = useRef<Record<SmaKey, ISeriesApi<"Line"> | null>>({
    sma20: null, sma50: null, sma200: null,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: colors.bg },
        textColor: colors.muted,
        fontFamily: fontFamilies.mono,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: colors.line },
        horzLines: { color: colors.line },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: colors.lineStrong },
      timeScale: { borderColor: colors.lineStrong, timeVisible: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });
    candleSeries.setData(candles);

    const volSeries = chart.addSeries(HistogramSeries, {
      color: colors.lineStrong,
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    volSeries.setData(volume);

    for (const { key, color, width } of SMA_META) {
      const data = key === "sma20" ? sma20 : key === "sma50" ? sma50 : sma200;
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: width,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData(data);
      smaSeries.current[key] = series;
    }

    const range = getVisibleRange(candles, "1Y");
    if (range) chart.timeScale().setVisibleRange(range);

    chartRef.current = chart;
    return () => { chart.remove(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartRef.current || !candles.length) return;
    const range = getVisibleRange(candles, timeRange);
    if (range) chartRef.current.timeScale().setVisibleRange(range);
  }, [timeRange, candles]);

  useEffect(() => { smaSeries.current.sma20?.applyOptions({ visible: showSma20 }); }, [showSma20]);
  useEffect(() => { smaSeries.current.sma50?.applyOptions({ visible: showSma50 }); }, [showSma50]);
  useEffect(() => { smaSeries.current.sma200?.applyOptions({ visible: showSma200 }); }, [showSma200]);

  const showMap: Record<SmaKey, boolean> = { sma20: showSma20, sma50: showSma50, sma200: showSma200 };

  return (
    <div>
      <div className="flex gap-[6px] mb-[10px] flex-wrap">
        {SMA_META.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => onToggleSma(key)}
            className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-[3px] font-mono text-[11px] tracking-[0.04em] border transition-opacity cursor-pointer"
            style={{
              borderColor: showMap[key] ? color : colors.line,
              color: showMap[key] ? color : colors.hint,
              opacity: showMap[key] ? 1 : 0.45,
              backgroundColor: colors.bgSoft,
            }}
          >
            <span
              className="inline-block w-[14px] rounded-full"
              style={{ height: key === "sma200" ? 2 : 1, backgroundColor: showMap[key] ? color : colors.line }}
            />
            {label}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-[4px] overflow-hidden"
        style={{ height: 340 }}
      />
    </div>
  );
}
