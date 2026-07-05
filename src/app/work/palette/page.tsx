// app/work/palette/page.tsx — seasonal color palette app (walking skeleton, issue #221).
// Server component: sets metadata, renders the project header, and hands the hardcoded
// Light Summer season to the client PaletteSkeleton. Season selector and the full engine
// arrive in later slices.

import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PaletteSkeleton } from "@/components/projects/palette/PaletteSkeleton";
import { LIGHT_SUMMER } from "@/lib/palette/season-data";

export const metadata: Metadata = {
  title: "Seasonal Color Palette — Will Maness",
  description:
    "Turn one color you like into outfit palettes that stay inside your seasonal color analysis gamut. Walking skeleton.",
};

export default function PalettePage() {
  return (
    <Container>
      <div className="mb-[48px]">
        <div className="flex items-center justify-between mb-[16px]">
          <SectionLabel>Prototype</SectionLabel>
          <Link
            href="/work"
            className="font-mono text-[12px] text-muted no-underline hover:text-accent transition-colors duration-[120ms]"
          >
            ← All projects
          </Link>
        </div>
        <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mb-[16px]">
          Seasonal color palette
        </h1>
        <p className="font-sans text-[16px] leading-[1.65] text-ink-soft max-w-[580px]">
          For people who already know their color season. Give it one color you like and it
          builds outfit palettes that stay inside your season. This first slice proves the
          pipeline: a color in, snapped to its nearest {LIGHT_SUMMER.name} shade.
        </p>
      </div>

      <PaletteSkeleton season={LIGHT_SUMMER} />

      <p className="font-sans text-[13px] text-hint mt-[56px] mb-[96px] max-w-[580px]">
        {LIGHT_SUMMER.blurb}
      </p>
    </Container>
  );
}
