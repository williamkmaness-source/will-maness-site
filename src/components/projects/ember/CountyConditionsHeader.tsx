// CountyConditionsHeader.tsx — County-level weather conditions banner for /ember.

import type { CountyConditions } from "@/lib/ember/ember-queries";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-hint">{label}</span>
      <span className="font-mono text-[14px] text-ink">{value}</span>
    </div>
  );
}

function formatObservedAt(iso: string): string {
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

interface CountyConditionsHeaderProps {
  conditions: CountyConditions;
}

export function CountyConditionsHeader({ conditions }: CountyConditionsHeaderProps) {
  const {
    county,
    windSpeed,
    windDirection,
    humidity,
    temperature,
    redFlag,
    observedAt,
  } = conditions;

  return (
    <div
      className={[
        "rounded-sm border p-[20px] mb-[32px]",
        redFlag ? "border-clay bg-clay-soft" : "border-line bg-bg-soft",
      ].join(" ")}
    >
      {redFlag && (
        <div className="flex items-center gap-[8px] mb-[14px]">
          <span className="inline-block w-[8px] h-[8px] rounded-full bg-clay shrink-0" />
          <span className="font-mono text-[11px] tracking-[0.06em] uppercase text-clay font-medium">
            Red Flag Warning
          </span>
        </div>
      )}

      <div className="flex items-baseline justify-between mb-[16px] flex-wrap gap-[8px]">
        <h2 className="font-serif text-[18px] font-medium text-ink leading-[1.3]">{county}</h2>
        <span className="font-mono text-[11px] text-hint">
          Observed {formatObservedAt(observedAt)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-[16px] sm:grid-cols-4">
        <Stat
          label="Wind"
          value={
            windSpeed != null
              ? `${windSpeed} mph ${windDirection ?? ""}`.trim()
              : "—"
          }
        />
        <Stat label="Humidity" value={humidity != null ? `${humidity}%` : "—"} />
        <Stat
          label="Temperature"
          value={temperature != null ? `${temperature}°F` : "—"}
        />
        <Stat
          label="Red Flag"
          value={redFlag ? "Active" : "None"}
        />
      </div>
    </div>
  );
}
