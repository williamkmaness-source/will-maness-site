"use client";

// ColorInput.tsx — the palette app's one color-input control, presented as two tabs: a hex
// field with a live preview, and the active season's swatch grid. Both modes report through
// the same onChange, so the engine never learns which one the user reached for.

import { useId, useState } from "react";
import type { Season } from "@/lib/palette/season-data";
import { SwatchGrid } from "./SwatchGrid";
import { cn } from "@/lib/utils";

type InputMode = "hex" | "swatch";

const MODES: { id: InputMode; label: string }[] = [
  { id: "hex", label: "Hex" },
  { id: "swatch", label: "Pick a swatch" },
];

interface ColorInputProps {
  season: Season;
  /** Raw text in the hex field — may be mid-edit and unparseable. */
  value: string;
  /** The color the engine is actually using, or null if it has never had a valid one. */
  resolved: string | null;
  /** True when `value` is non-empty and cannot be read as a color. */
  invalid: boolean;
  onChange: (next: string) => void;
}

export function ColorInput({
  season,
  value,
  resolved,
  invalid,
  onChange,
}: ColorInputProps) {
  const [mode, setMode] = useState<InputMode>("hex");
  const baseId = useId();
  const fieldId = `${baseId}-hex`;

  return (
    <div className="flex flex-col gap-[14px] max-w-[560px]">
      <div role="tablist" aria-label="Color input method" className="flex gap-[4px]">
        {MODES.map(({ id, label }) => {
          const isActive = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${id}`}
              onClick={() => setMode(id)}
              className={cn(
                "font-sans text-[13px] font-medium rounded-sm px-[14px] py-[9px] border outline-none transition-colors cursor-pointer",
                isActive
                  ? "border-accent text-ink bg-bg-soft"
                  : "border-line text-muted hover:text-ink-soft hover:border-line-strong focus-visible:border-accent"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {mode === "hex" ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-hex`}
          aria-labelledby={`${baseId}-tab-hex`}
          className="flex flex-col gap-[10px]"
        >
          <label
            htmlFor={fieldId}
            className="font-sans text-[14px] font-medium text-ink-soft"
          >
            Enter a color (hex)
          </label>
          <div className="flex items-center gap-[12px]">
            <div
              aria-hidden
              className="rounded-sm border border-line-strong shrink-0"
              style={{
                backgroundColor: resolved ?? "transparent",
                width: 40,
                height: 40,
              }}
            />
            <input
              id={fieldId}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="#7fb0d0"
              aria-invalid={invalid}
              className="font-mono text-[15px] text-ink bg-bg-soft border border-line rounded-sm px-[14px] py-[10px] w-full max-w-[220px] outline-none focus:border-accent"
            />
          </div>
          {invalid && (
            <span role="status" className="font-sans text-[13px] text-clay">
              Not a color I can read — still showing your last one. Try a hex like{" "}
              <span className="font-mono">#7fb0d0</span>.
            </span>
          )}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${baseId}-panel-swatch`}
          aria-labelledby={`${baseId}-tab-swatch`}
          className="flex flex-col gap-[10px]"
        >
          <span className="font-sans text-[14px] font-medium text-ink-soft">
            Pick a color from {season.name}
          </span>
          <SwatchGrid season={season} selected={resolved} onSelect={onChange} />
        </div>
      )}
    </div>
  );
}
