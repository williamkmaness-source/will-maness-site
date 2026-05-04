// MetaStrip.tsx — the horizontal bar of metadata below a project/post headline.
// Shows date, read time, and a "self-initiated" pill. Bordered top and bottom with
// 0.5px lines. Reused on project pages and writing posts.

import { cn } from "@/lib/utils";

interface MetaStripProps {
  date: string;
  readTime?: string;
  pill?: string;
  className?: string;
}

export function MetaStrip({ date, readTime, pill, className }: MetaStripProps) {
  return (
    <div
      className={cn(
        "flex gap-[18px] items-center py-[14px]",
        "border-t border-b border-line",
        "text-[13px] text-muted font-sans",
        className
      )}
    >
      <span>{date}</span>
      {readTime && (
        <>
          <span className="text-line-strong">·</span>
          <span>{readTime}</span>
        </>
      )}
      {pill && (
        <>
          <span className="text-line-strong">·</span>
          <span className="bg-accent-soft text-muted px-[9px] py-[3px] rounded-sm text-[11px]">
            {pill}
          </span>
        </>
      )}
    </div>
  );
}
