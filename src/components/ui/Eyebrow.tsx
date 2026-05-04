// Eyebrow.tsx — article category label above project/post headlines.
// Mono, 12px, uppercase, clay color. Used sparingly — it's the clay signature moment
// on content pages. See design-tokens.md for the clay usage philosophy.

import { cn } from "@/lib/utils";

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <div
      className={cn(
        "font-mono text-[12px] leading-[1.5] tracking-[0.06em] uppercase text-clay mb-[20px]",
        className
      )}
    >
      {children}
    </div>
  );
}
