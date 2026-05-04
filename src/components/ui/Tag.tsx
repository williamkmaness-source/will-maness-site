// Tag.tsx — small pill label used on project cards (engineering, research, data, etc.).
// Sans 11px, accent-soft background, muted text, 4px radius. Used in card meta rows.

import { cn } from "@/lib/utils";

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

export function Tag({ children, className }: TagProps) {
  return (
    <span
      className={cn(
        "bg-accent-soft text-muted px-[10px] py-[3px] rounded-sm",
        "font-sans text-[11px] leading-[1.4] tracking-[0.02em]",
        className
      )}
    >
      {children}
    </span>
  );
}
