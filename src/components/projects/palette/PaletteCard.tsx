"use client";

// PaletteCard.tsx — card for one four-role outfit palette. Renders Base, Secondary,
// Neutral, and Accent as labeled color blocks; clicking a block copies its hex and swaps
// the label to a short confirmation. Colors are data (inline style); all chrome stays on
// design tokens.

import type { RolePalette } from "@/lib/palette/palette-assembler";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useCopyHex } from "./use-copy-hex";

const ROLE_ORDER: { key: keyof Omit<RolePalette, "scheme">; label: string; hint: string }[] = [
  { key: "base", label: "Base", hint: "your color" },
  { key: "secondary", label: "Secondary", hint: "harmony partner" },
  { key: "neutral", label: "Neutral", hint: "grounding tone" },
  { key: "accent", label: "Accent", hint: "the pop" },
];

function RoleSwatch({
  hex,
  label,
  hint,
  copied,
  onCopy,
}: {
  hex: string;
  label: string;
  hint: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-[8px] min-w-0">
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${hex.toUpperCase()}`}
        className="w-full h-[96px] rounded-md border border-line-strong outline-none transition-colors cursor-pointer hover:border-ink-soft focus-visible:border-accent"
        style={{ backgroundColor: hex }}
      />
      <div className="flex flex-col min-w-0">
        <SectionLabel>{label}</SectionLabel>
        <span
          aria-live="polite"
          className={`font-mono text-[13px] tabular-nums uppercase ${
            copied ? "text-accent" : "text-muted"
          }`}
        >
          {copied ? "Copied" : hex}
        </span>
        <span className="font-sans text-[12px] text-hint">{hint}</span>
      </div>
    </div>
  );
}

export function PaletteCard({ palette }: { palette: RolePalette }) {
  const { copiedKey, copy } = useCopyHex();

  return (
    <div className="border border-line rounded-lg bg-bg-soft/40 p-[16px] sm:p-[20px]">
      <div className="mb-[16px]">
        <SectionLabel>{palette.scheme} palette</SectionLabel>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[16px]">
        {ROLE_ORDER.map(({ key, label, hint }) => {
          const copyKey = `${palette.scheme}-${key}`;
          return (
            <RoleSwatch
              key={key}
              hex={palette[key]}
              label={label}
              hint={hint}
              copied={copiedKey === copyKey}
              onCopy={() => copy(palette[key], copyKey)}
            />
          );
        })}
      </div>
    </div>
  );
}
