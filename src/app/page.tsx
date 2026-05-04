// app/page.tsx — homepage. Phase 0 placeholder: renders a styled "coming soon" message
// that proves the token system, fonts, and layout primitives are wired correctly.
// This file will be replaced with the full homepage design in Phase 1.

import { Container } from "@/components/layout/Container";
import { ClayDot } from "@/components/ui/ClayDot";

export default function Home() {
  return (
    <Container>
      <div className="flex flex-col gap-[24px] py-[96px]">
        <p className="font-mono text-[12px] tracking-[0.06em] uppercase text-muted">
          Phase 0 · Foundation
        </p>
        <h1 className="font-serif text-[52px] font-medium leading-[1.15] tracking-[-0.015em] text-ink max-w-[720px]">
          Something worth reading{" "}
          <em className="text-accent italic">is on its way.</em>
        </h1>
        <p className="font-sans text-[17px] leading-[1.55] text-muted max-w-[540px]">
          Will Maness · Strategy and operating background, spending serious time
          in the trenches with the AI-and-data stack.
        </p>
        <div className="flex items-center gap-[10px] font-mono text-[12px] tracking-[0.02em] text-muted mt-[4px]">
          <ClayDot />
          currently in Boston · building in the open
        </div>
      </div>
    </Container>
  );
}
