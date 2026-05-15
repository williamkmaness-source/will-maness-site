'use client';

// Dynamic import — EventSource is browser-only; keeps the component out of the SSR pass.
import dynamic from 'next/dynamic';

export const PipelineDashboard = dynamic(
  () =>
    import('./PipelineDashboard').then((m) => ({ default: m.PipelineDashboard })),
  { ssr: false },
);
