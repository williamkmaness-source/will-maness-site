'use client';

import { usePipelineStatus } from './usePipelineStatus';
import { PipelineCard } from './PipelineCard';

// Skeleton placeholder cards shown while the SSE connection establishes.
function SkeletonCard() {
  return (
    <div className="bg-bg-soft border border-line rounded-lg p-[20px] h-[124px] animate-pulse" />
  );
}

export function PipelineDashboard() {
  const { statuses, connected } = usePipelineStatus();

  return (
    <div className="my-[40px]">
      <div className="flex items-center gap-[8px] mb-[20px]">
        <span
          aria-hidden="true"
          className="w-[8px] h-[8px] rounded-full flex-shrink-0 transition-colors duration-300"
          style={{ background: connected ? '#22c55e' : '#9ca3af' }}
        />
        <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-muted">
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
        {statuses.length === 0 ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          statuses.map((s) => <PipelineCard key={s.pipeline} status={s} />)
        )}
      </div>
    </div>
  );
}
