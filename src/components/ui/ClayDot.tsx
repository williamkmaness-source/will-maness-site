// ClayDot.tsx — the 7px clay-colored circle used as a status indicator.
// Appears in the hero "currently in Boston" line and the about page say-hi block.
// This is the "personal mark moment" referenced in design-tokens.md — use it sparingly.

import { cn } from "@/lib/utils";

interface ClayDotProps {
  className?: string;
}

export function ClayDot({ className }: ClayDotProps) {
  return (
    <span
      className={cn("inline-block w-[7px] h-[7px] rounded-full bg-clay shrink-0", className)}
      aria-hidden="true"
    />
  );
}
