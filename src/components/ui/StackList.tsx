// StackList.tsx — the tools-with-status-dots block on project pages (e.g., local AI stack writeup).
// Each row: colored dot, tool name (mono), description (serif), usage frequency label.
// Used as a custom MDX component: <StackList items={[...]} /> inside project MDX files.

interface StackItem {
  name: string;
  role: string;
  frequency: "daily" | "weekly" | "occasional";
}

interface StackListProps {
  items: StackItem[];
}

const dotColors: Record<StackItem["frequency"], string> = {
  daily: "bg-accent",
  weekly: "bg-[#8C9D7B]",
  occasional: "bg-[#C8BFA8]",
};

const frequencyLabels: Record<StackItem["frequency"], string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  occasional: "OCCASIONAL",
};

export function StackList({ items }: StackListProps) {
  return (
    <div className="my-[32px]">
      <div className="border-t border-line">
        {items.map((item) => (
          <div
            key={item.name}
            className="grid gap-[16px] items-center py-[14px] border-b border-line font-sans"
            style={{ gridTemplateColumns: "22px 1.4fr 2fr 110px" }}
          >
            <span
              className={`w-[8px] h-[8px] rounded-full inline-block ${dotColors[item.frequency]}`}
            />
            <span className="font-mono text-[14px] text-ink font-medium">
              {item.name}
            </span>
            <span className="font-serif text-[16px] text-prose leading-[1.4]">
              {item.role}
            </span>
            <span className="font-mono text-[11px] text-muted text-right tracking-[0.02em]">
              {frequencyLabels[item.frequency]}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-[18px] font-mono text-[11px] text-muted mt-[12px] mb-[12px]">
        <span className="inline-flex items-center gap-[6px]">
          <span className="w-[6px] h-[6px] rounded-full bg-accent inline-block" />
          daily driver
        </span>
        <span className="inline-flex items-center gap-[6px]">
          <span className="w-[6px] h-[6px] rounded-full bg-[#8C9D7B] inline-block" />
          regular use
        </span>
        <span className="inline-flex items-center gap-[6px]">
          <span className="w-[6px] h-[6px] rounded-full bg-[#C8BFA8] inline-block" />
          specific cases
        </span>
      </div>
    </div>
  );
}
