// mdx-components.tsx — required by Next.js App Router when using @next/mdx.
// This file registers React components that are available inside every .mdx file
// without needing an explicit import. Add custom components here as the project grows
// (e.g., <ViennaTrainer /> for Phase 2). See docs/concepts.md#mdx-components.

import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
  };
}
