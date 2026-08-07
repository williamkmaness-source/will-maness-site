// index.tsx — MDX entry point for the music analyzer (issue #216).
// Lets the project MDX embed the whole app with no props (<MusicAnalyzer />), matching
// how the other project widgets are registered in mdx-components.tsx.

import { MusicAnalyzerTabs } from "./MusicAnalyzerTabs";

export function MusicAnalyzer() {
  return <MusicAnalyzerTabs />;
}
