"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  HistogramSeries,
  type IChartApi,
} from "lightweight-charts";
import type { SpxSeries, SpxMacd } from "@/lib/spx-types";
import { colors, fontFamilies } from "@/lib/tokens";

type Props = {
  rsi: SpxSeries[];
  macd: SpxMacd;
};

const MOBILE_BREAKPOINT = 600;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

const CHART_OPTIONS = {
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
  timeScale: { borderColor: colors.lineStrong, timeVisible: false, visible: false },
  handleScroll: false,
  handleScale: false,
} as const;

export function SpxIndicatorPanels({ rsi, macd }: Props) {
  const isMobile = useIsMobile();
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!rsiRef.current || !macdRef.current) return;

    // RSI chart
    const rsiChart = createChart(rsiRef.current, CHART_OPTIONS);
    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: colors.inkSoft,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    rsiSeries.setData(rsi);
    rsiSeries.createPriceLine({ price: 70, color: colors.clay,   lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "OB" });
    rsiSeries.createPriceLine({ price: 30, color: colors.accent, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "OS" });
    rsiChart.timeScale().setVisibleRange({ from: rsi[0]?.time ?? "", to: rsi[rsi.length - 1]?.time ?? "" });
    rsiChartRef.current = rsiChart;

    // MACD chart
    const macdChart = createChart(macdRef.current, CHART_OPTIONS);

    const histSeries = macdChart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    });
    histSeries.setData(
      macd.histogram.map((d) => ({
        time: d.time,
        value: d.value,
        color: d.value >= 0 ? "#3A7D5A" : colors.clay,
      }))
    );

    const macdLineSeries = macdChart.addSeries(LineSeries, {
      color: colors.ink,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    macdLineSeries.setData(macd.macd);

    const signalSeries = macdChart.addSeries(LineSeries, {
      color: colors.clay,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    signalSeries.setData(macd.signal);

    macdChart.timeScale().setVisibleRange({ from: macd.macd[0]?.time ?? "", to: macd.macd[macd.macd.length - 1]?.time ?? "" });
    macdChartRef.current = macdChart;

    // Crosshair sync
    rsiChart.subscribeCrosshairMove((param) => {
      if (param.time) macdChart.setCrosshairPosition(0, param.time, histSeries);
      else macdChart.clearCrosshairPosition();
    });
    macdChart.subscribeCrosshairMove((param) => {
      if (param.time) rsiChart.setCrosshairPosition(0, param.time, rsiSeries);
      else rsiChart.clearCrosshairPosition();
    });

    return () => {
      rsiChart.remove();
      macdChart.remove();
      rsiChartRef.current = null;
      macdChartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isMobile) {
    return (
      <p className="font-mono text-[11px] tracking-[0.04em] text-hint text-center py-[24px]">
        For the full analysis view, open on desktop
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[4px]">
      <div>
        <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[4px]">RSI (14)</p>
        <div ref={rsiRef} className="w-full rounded-[4px] overflow-hidden" style={{ height: 100 }} />
      </div>
      <div>
        <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[4px]">MACD (12 · 26 · 9)</p>
        <div ref={macdRef} className="w-full rounded-[4px] overflow-hidden" style={{ height: 110 }} />
      </div>
    </div>
  );
}
