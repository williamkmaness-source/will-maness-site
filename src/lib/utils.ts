// utils.ts — shared utility functions.
// cn() merges Tailwind class strings, filtering out falsy values.
// Avoids pulling in clsx/tailwind-merge as dependencies for this simple need.

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
