// Container.tsx — centers content horizontally with the site's max-width and side padding.
// Every full-width section (nav, footer, page bodies) wraps its content in this.
// Max-width and padding values come from lib/tokens.ts via CSS custom properties.

import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full px-[48px] max-[640px]:px-[24px]", className)}
      style={{ maxWidth: "var(--container-max)" }}
    >
      {children}
    </div>
  );
}
