// ClusterCard.tsx — Card for a single satellite-detected fire cluster.

import type { FireCluster, ClusterTier } from "@/lib/ember/ember-queries";
import type { WeatherObservation } from "@/lib/ember/weather-client";
import { degreesToCardinal } from "@/lib/ember/weather-client";
import type { BriefingResult } from "@/lib/ember/ember-briefing";

const TIER_STYLES: Record<ClusterTier, { bg: string; text: string; dot: string }> = {
  Monitor: { bg: "bg-accent-soft", text: "text-accent", dot: "bg-accent" },
  Watch:   { bg: "bg-clay-soft",   text: "text-clay",   dot: "bg-clay"   },
  Action:  { bg: "bg-clay",        text: "text-bg",     dot: "bg-bg"     },
};

function TierBadge({ tier }: { tier: ClusterTier }) {
  const s = TIER_STYLES[tier];
  return (
    <span
      className={[
        "inline-flex items-center gap-[5px] font-mono text-[10px] tracking-[0.06em] uppercase px-[8px] py-[3px] rounded-sm",
        s.bg, s.text,
      ].join(" ")}
    >
      <span className={`w-[5px] h-[5px] rounded-full ${s.dot}`} />
      {tier}
    </span>
  );
}

function formatDetectedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function parseBriefing(raw: string | null): BriefingResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const { currentSituation, weatherContext, outlook } = parsed;
    if (
      typeof currentSituation !== "string" ||
      typeof weatherContext !== "string" ||
      typeof outlook !== "string"
    ) return null;
    return { currentSituation, weatherContext, outlook };
  } catch {
    return null;
  }
}

function parseWeather(raw: Record<string, unknown> | null): WeatherObservation | null {
  if (!raw) return null;
  return {
    stationId: typeof raw.stationId === "string" ? raw.stationId : "unknown",
    windSpeedMph: typeof raw.windSpeedMph === "number" ? raw.windSpeedMph : null,
    windDirectionDeg: typeof raw.windDirectionDeg === "number" ? raw.windDirectionDeg : null,
    windGustMph: typeof raw.windGustMph === "number" ? raw.windGustMph : null,
    humidityPct: typeof raw.humidityPct === "number" ? raw.humidityPct : null,
    temperatureF: typeof raw.temperatureF === "number" ? raw.temperatureF : null,
    precip24hIn: typeof raw.precip24hIn === "number" ? raw.precip24hIn : null,
    observedAt: typeof raw.observedAt === "string" ? raw.observedAt : "",
  };
}

interface ClusterCardProps {
  cluster: FireCluster;
}

export function ClusterCard({ cluster }: ClusterCardProps) {
  const { lat, lng, frp, detectionCount, detectedAt, tier, riskScore, weather: weatherRaw, briefing: briefingRaw, briefingGeneratedAt } = cluster;
  const weather = parseWeather(weatherRaw);
  const briefing = parseBriefing(briefingRaw);

  const windLabel =
    weather?.windSpeedMph != null
      ? `${Math.round(weather.windSpeedMph)} mph${weather.windDirectionDeg != null ? ` ${degreesToCardinal(weather.windDirectionDeg)}` : ""}`
      : "—";

  const isMonitor = tier === "Monitor";

  return (
    <article className={[
      "border rounded-sm p-[20px]",
      isMonitor ? "border-line bg-bg opacity-70" : "border-line bg-bg",
    ].join(" ")}>
      <div className="flex items-start justify-between gap-[12px] mb-[14px] flex-wrap">
        <div className="flex items-center gap-[8px] flex-wrap">
          {tier && <TierBadge tier={tier} />}
          {riskScore != null && (
            <span className="font-mono text-[11px] text-muted">
              Risk {Math.round(riskScore)}
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-hint shrink-0">
          {formatDetectedAt(detectedAt)}
        </span>
      </div>

      {/* Fire metrics */}
      <div className="grid grid-cols-2 gap-x-[24px] gap-y-[10px] sm:grid-cols-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[2px]">FRP</p>
          <p className="font-mono text-[15px] text-ink">{frp.toFixed(1)} <span className="text-hint text-[11px]">MW</span></p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[2px]">Detections</p>
          <p className="font-mono text-[15px] text-ink">{detectionCount}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[2px]">Lat</p>
          <p className="font-mono text-[15px] text-ink">{lat.toFixed(3)}°</p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[2px]">Lng</p>
          <p className="font-mono text-[15px] text-ink">{lng.toFixed(3)}°</p>
        </div>
      </div>

      {/* Weather conditions — only shown when observation data exists */}
      {weather && (
        <div className="mt-[14px] pt-[14px] border-t border-line grid grid-cols-3 gap-x-[24px] gap-y-[10px]">
          <div>
            <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[2px]">Wind</p>
            <p className="font-mono text-[13px] text-ink-soft">{windLabel}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[2px]">Humidity</p>
            <p className="font-mono text-[13px] text-ink-soft">
              {weather.humidityPct != null ? `${Math.round(weather.humidityPct)}%` : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[2px]">Temp</p>
            <p className="font-mono text-[13px] text-ink-soft">
              {weather.temperatureF != null ? `${Math.round(weather.temperatureF)}°F` : "—"}
            </p>
          </div>
        </div>
      )}

      {/* AI briefing — only rendered for Action-tier clusters when a briefing is available */}
      {tier === "Action" && briefing && (
        <div className="mt-[16px] pt-[16px] border-t border-line space-y-[12px]">
          <div>
            <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[4px]">Current Situation</p>
            <p className="font-sans text-[13px] leading-[1.6] text-ink-soft">{briefing.currentSituation}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[4px]">Weather Context</p>
            <p className="font-sans text-[13px] leading-[1.6] text-ink-soft">{briefing.weatherContext}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint mb-[4px]">6-Hour Outlook</p>
            <p className="font-sans text-[13px] leading-[1.6] text-ink-soft">{briefing.outlook}</p>
          </div>
          <p className="font-mono text-[10px] text-hint">
            AI-generated from satellite and weather data
            {briefingGeneratedAt && (
              <> · Generated {new Date(briefingGeneratedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</>
            )}
          </p>
        </div>
      )}
    </article>
  );
}
