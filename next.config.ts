// next.config.ts — Next.js configuration.
// The withMDX wrapper tells Next to treat .mdx files as pages or importable modules.
// pageExtensions lets the App Router discover MDX files as routes automatically.
// "remark-frontmatter" is specified as a string (not an import) because Turbopack
// requires serializable plugin references — JavaScript functions can't be passed to Rust.
// See docs/concepts.md#mdx for why we use this approach instead of a CMS.

import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    remarkPlugins: [
      // Strips the ---...--- YAML frontmatter block before MDX compiles to JSX.
      // Without this, frontmatter renders as visible text when .mdx files are imported.
      "remark-frontmatter",
    ],
  },
});

export default withMDX(nextConfig);
