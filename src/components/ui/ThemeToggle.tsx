'use client';

import { useTheme } from '@/components/layout/ThemeProvider';

const LABELS: Record<string, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const NEXT: Record<string, 'light' | 'dark' | 'system'> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <button
      onClick={() => setPreference(NEXT[preference])}
      aria-label={`Switch theme (currently ${LABELS[preference]})`}
      title={`Theme: ${LABELS[preference]}`}
      className="font-mono text-[11px] tracking-[0.04em] uppercase text-hint hover:text-ink transition-colors duration-[120ms] cursor-pointer select-none"
    >
      {preference === 'dark' ? '◐' : preference === 'light' ? '○' : '◑'}
    </button>
  );
}
