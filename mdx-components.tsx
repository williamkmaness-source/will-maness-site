// mdx-components.tsx — required by Next.js App Router when using @next/mdx.
// Registers styled React components for HTML elements inside .mdx files.
// Prose elements (p, h2, blockquote, code, pre, a) match the design system exactly.
// Custom components (StackList, ViennaTrainer, ChessTracker) are registered here as they ship.
// See docs/concepts.md#mdx-components.

import type { MDXComponents } from "mdx/types";
import { StackList } from "@/components/ui/StackList";
import { ViennaTrainer } from "@/components/projects/vienna-trainer";
import { BostonCivicTracker } from "@/components/projects/boston-civic-data";
import { ChessTracker } from "@/components/projects/chess";
import { PipelineDashboard } from "@/components/projects/pipeline-dashboard";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Semantic HTML with design-system styles.
    h2: ({ children }) => (
      <h2 className="font-serif text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink mt-[64px] mb-[20px]">
        {children}
      </h2>
    ),
    p: ({ children }) => (
      <p className="font-serif text-[18px] leading-[1.65] text-prose mb-[24px]">
        {children}
      </p>
    ),
    // The "aside" style from the mockup: clay left border, italic, clay text.
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-accent pl-[24px] my-[36px] font-serif italic text-[22px] leading-[1.45] text-ink">
        {children}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-accent no-underline border-b border-accent/50 pb-[1px] hover:border-accent transition-colors duration-[120ms]"
      >
        {children}
      </a>
    ),
    code: ({ children }) => (
      <code className="font-mono text-[0.86em] bg-bg-code px-[6px] py-[1px] rounded-xs text-ink">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-bg-code rounded-lg px-[24px] py-[20px] overflow-x-auto my-[28px] border border-line font-mono text-[13.5px] leading-[1.65] text-ink">
        {children}
      </pre>
    ),
    // Custom project components — register each here as they ship.
    StackList,
    ViennaTrainer,
    BostonCivicTracker,
    ChessTracker,
    PipelineDashboard,
    ...components,
  };
}
