// next.config.ts — Next.js configuration.
// The withMDX wrapper tells Next to treat .mdx files as pages or importable modules.
// pageExtensions lets the App Router discover MDX files as routes automatically.
// See docs/concepts.md#mdx for why we use this approach instead of a CMS.

import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
});

export default withMDX(nextConfig);
