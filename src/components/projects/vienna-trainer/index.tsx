'use client';

// Dynamic import wrapper — loads ViennaTrainer only in the browser (ssr: false).
// Prevents react-chessboard and chess.js from being included in the server bundle.
// Shows ViennaTrainerSkeleton while the chunk hydrates.
// Must be a Client Component because ssr: false is not allowed in Server Components.

import dynamic from 'next/dynamic';
import { ViennaTrainerSkeleton } from './ViennaTrainerSkeleton';

export const ViennaTrainer = dynamic(
  () => import('./ViennaTrainer').then((m) => ({ default: m.ViennaTrainer })),
  { ssr: false, loading: () => <ViennaTrainerSkeleton /> },
);
