// Stack.tsx — vertical flex container with consistent gap between children.
// Use this instead of adding margin to individual components; keeps spacing declarative.
// The gap prop accepts any Tailwind spacing value ("lg", "2xl", etc.).

import { cn } from "@/lib/utils";

interface StackProps {
  children: React.ReactNode;
  gap?: string;
  className?: string;
  as?: React.ElementType;
}

export function Stack({
  children,
  gap = "lg",
  className,
  as: Tag = "div",
}: StackProps) {
  return (
    <Tag className={cn("flex flex-col", `gap-${gap}`, className)}>
      {children}
    </Tag>
  );
}
