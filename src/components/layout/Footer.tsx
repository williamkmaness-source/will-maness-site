// Footer.tsx — site-wide footer. Location on left, contact links on right.
// Visible on every page so a visitor who finishes reading can reach Will immediately.
// Copy is hardcoded here because it's structural (aria labels, link text) not editorial —
// the one exception to the "no copy in components" rule from the brief.

import Link from "next/link";
import { Container } from "./Container";

export function Footer() {
  return (
    <footer>
      <Container>
        <div className="border-t border-line mt-[96px] pt-[32px] pb-[48px] flex justify-between items-center font-sans text-[14px] text-muted">
          <span>Will Maness · Boston</span>
          <div className="flex items-center gap-[24px]">
            <Link
              href="mailto:will@willmaness.com"
              className="text-ink no-underline hover:text-accent transition-colors duration-[120ms]"
            >
              will@willmaness.com
            </Link>
            <Link
              href="https://github.com/wkmaness"
              className="text-ink no-underline hover:text-accent transition-colors duration-[120ms]"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
            <Link
              href="https://linkedin.com/in/willmaness"
              className="text-ink no-underline hover:text-accent transition-colors duration-[120ms]"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </Link>
            <Link
              href="https://twitter.com/willmaness"
              className="text-ink no-underline hover:text-accent transition-colors duration-[120ms]"
              target="_blank"
              rel="noopener noreferrer"
            >
              Twitter
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
