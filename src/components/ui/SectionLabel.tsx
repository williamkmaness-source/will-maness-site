// SectionLabel.tsx — the small uppercase sans label above each homepage section
// ("Selected work", "Recent writing"). Matches the label token: sans, 12px, 500 weight,
// 0.06em tracking, muted color.

import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <span
      className={cn(
        "font-sans text-[12px] font-medium leading-[1.5] tracking-[0.06em] uppercase text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
