'use client';

import Link from 'next/link';
import type { PipelineStatus, PipelineStatusValue } from './types';

const STATUS_LABELS: Record<PipelineStatusValue, string> = {
  success: 'Healthy',
  failed: 'Failed',
  running: 'Running',
  unknown: 'Unknown',
};

// Intentional raw hex — these are semantic health indicators, not design-system brand colors.
const STATUS_DOT_COLOR: Record<PipelineStatusValue, string> = {
  success: '#22c55e',
  failed:  '#ef4444',
  running: '#f59e0b',
  unknown: '#9ca3af',
};

const DATA_SOURCE: Record<string, string> = {
  '311': 'Analyze Boston CKAN',
  chess:  'Lichess Broadcasts API',
  'vendor-feed': 'GitHub Actions → Neon',
};

const DISPLAY_NAMES: Record<string, string> = {
  '311': 'Boston 311',
  chess: 'Chess',
  'vendor-feed': 'Vendor Feed',
};

const OUTPUT_LINK: Record<string, string> = {
  'vendor-feed': '/work/vendor_feed',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PipelineCard({ status }: { status: PipelineStatus }) {
  const dotColor = STATUS_DOT_COLOR[status.status];
  const label = STATUS_LABELS[status.status];
  const source = DATA_SOURCE[status.pipeline] ?? status.pipeline;
  const displayName = DISPLAY_NAMES[status.pipeline] ?? status.pipeline;
  const outputLink = OUTPUT_LINK[status.pipeline];

  return (
    <div className="bg-bg-soft border border-line rounded-lg p-[20px] flex flex-col gap-[12px]">
      <div className="flex items-start justify-between gap-[12px]">
        <div>
          <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-clay">
            {displayName}
          </span>
          <p className="font-sans text-[13px] text-muted mt-[2px]">
            {source}
            {outputLink && (
              <>
                {' · '}
                <Link href={outputLink} className="underline underline-offset-2 hover:text-ink transition-colors">
                  View output
                </Link>
              </>
            )}
          </p>
        </div>
        <span
          role="img"
          aria-label={`Status: ${label}`}
          title={label}
          style={{ background: dotColor }}
          className="mt-[3px] w-[10px] h-[10px] rounded-full flex-shrink-0"
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-[16px] gap-y-[8px]">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.04em] text-hint">Last success</dt>
          <dd className="font-sans text-[13px] text-ink mt-[2px]">
            {formatTimestamp(status.lastSuccessAt)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.04em] text-hint">Records</dt>
          <dd className="font-sans text-[13px] text-ink mt-[2px]">
            {status.recordCount !== null ? status.recordCount.toLocaleString() : '—'}
          </dd>
        </div>
      </dl>

      {status.error && (
        <p className="font-mono text-[11px] text-clay bg-clay-soft px-[12px] py-[8px] rounded-md leading-relaxed">
          {status.error}
        </p>
      )}
    </div>
  );
}
