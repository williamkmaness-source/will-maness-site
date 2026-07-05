// PaletteCard.tsx — presentational card for one four-role outfit palette. Renders Base,
// Secondary, Neutral, and Accent as labeled color blocks with their hex codes. Colors are
// data (inline style); all chrome stays on design tokens. No state — pure props.

import type { RolePalette } from "@/lib/palette/palette-assembler";
import { SectionLabel } from "@/components/ui/SectionLabel";

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
}: {
  hex: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-start gap-[8px] min-w-0">
      <div
        className="w-full h-[96px] rounded-md border border-line-strong"
        style={{ backgroundColor: hex }}
      />
      <div className="flex flex-col">
        <SectionLabel>{label}</SectionLabel>
        <span className="font-mono text-[13px] text-muted tabular-nums uppercase">{hex}</span>
        <span className="font-sans text-[12px] text-hint">{hint}</span>
      </div>
    </div>
  );
}

export function PaletteCard({ palette }: { palette: RolePalette }) {
  return (
    <div className="border border-line rounded-lg bg-bg-soft/40 p-[20px]">
      <div className="mb-[16px]">
        <SectionLabel>{palette.scheme} palette</SectionLabel>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[16px]">
        {ROLE_ORDER.map(({ key, label, hint }) => (
          <RoleSwatch key={key} hex={palette[key]} label={label} hint={hint} />
        ))}
      </div>
    </div>
  );
}
