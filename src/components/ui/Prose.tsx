// Prose.tsx — applies the long-form reading typography to its children.
// Used for project pages and writing posts. Handles p, h2, h3, a, code, blockquote, em.
// All type values (size, line-height, weight) match design-tokens.md exactly.

import { cn } from "@/lib/utils";

interface ProseProps {
  children: React.ReactNode;
  className?: string;
}

export function Prose({ children, className }: ProseProps) {
  return (
    <div
      className={cn(
        // Paragraphs
        "[&_p]:font-serif [&_p]:text-[18px] [&_p]:leading-[1.65] [&_p]:text-prose [&_p]:mb-[24px]",
        // Headings
        "[&_h2]:font-serif [&_h2]:text-[28px] [&_h2]:font-medium [&_h2]:leading-[1.25] [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_h2]:mt-[64px] [&_h2]:mb-[20px]",
        "[&_h3]:font-serif [&_h3]:text-[24px] [&_h3]:font-medium [&_h3]:leading-[1.3] [&_h3]:tracking-[-0.01em] [&_h3]:text-ink [&_h3]:mt-[48px] [&_h3]:mb-[16px]",
        // Links
        "[&_a]:text-accent [&_a]:no-underline [&_a]:border-b [&_a]:border-accent [&_a]:border-opacity-100 [&_a]:pb-px",
        // Inline code
        "[&_code]:font-mono [&_code]:text-[0.86em] [&_code]:bg-bg-code [&_code]:px-[6px] [&_code]:py-px [&_code]:rounded-xs [&_code]:text-ink",
        // Code blocks
        "[&_pre]:bg-bg-code [&_pre]:border [&_pre]:border-line [&_pre]:rounded-lg [&_pre]:p-[20px_24px] [&_pre]:overflow-x-auto [&_pre]:my-[28px]",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:text-[13.5px] [&_pre_code]:leading-[1.65]",
        // Blockquote
        "[&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-[24px] [&_blockquote]:my-[36px] [&_blockquote]:font-serif [&_blockquote]:italic [&_blockquote]:text-[22px] [&_blockquote]:leading-[1.45] [&_blockquote]:text-ink",
        // Em / strong
        "[&_em]:italic",
        "[&_strong]:font-medium",
        className
      )}
    >
      {children}
    </div>
  );
}
