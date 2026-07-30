"use client";

// use-copy-hex.ts — one-click hex copy with transient "copied" feedback, shared by the
// result cards and the swatch picker. Feedback is keyed by a caller-supplied id rather than
// by the hex itself, so a color that appears in more than one swatch only confirms on the
// swatch actually clicked. Copy failures (no clipboard, denied permission) stay silent.

import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_MS = 1200;

export function useCopyHex() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(async (hex: string, key: string) => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(hex.toUpperCase());
    } catch {
      return;
    }
    setCopiedKey(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiedKey(null), FEEDBACK_MS);
  }, []);

  return { copiedKey, copy };
}
