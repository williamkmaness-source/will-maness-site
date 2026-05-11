'use client';

// Dynamic import wrapper — loads ChessTrackerInner only in the browser (ssr: false).
// Prevents fetch-on-server and keeps the Lichess polling loop client-side only.
// Shows ChessTrackerSkeleton while the chunk hydrates.

import dynamic from 'next/dynamic';
import { ChessTrackerSkeleton } from './ChessTrackerSkeleton';

export const ChessTracker = dynamic(
  () => import('./ChessTrackerInner').then((m) => ({ default: m.ChessTrackerInner })),
  { ssr: false, loading: () => <ChessTrackerSkeleton /> },
);
