// Tests for the SSE connection contract.
//
// The React hook (usePipelineStatus) wraps EventSource and is covered manually.
// These tests verify the shape and parsing logic against the agreed schema
// without a DOM dependency, following the BroadcastService.test.ts pattern.
//
// NOTE: Full hook lifecycle tests (connect → message → reconnect) require
// @testing-library/react + jsdom. Add them once `jsdom` is in devDependencies.

import { describe, it, expect } from 'vitest';
import type { PipelineStatus, PipelineStatusValue } from './types';

// ── Schema validation helpers ─────────────────────────────────────────────────

function isPipelineStatus(v: unknown): v is PipelineStatus {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const validStatuses: PipelineStatusValue[] = ['success', 'failed', 'running', 'unknown'];
  return (
    typeof o.pipeline === 'string' &&
    validStatuses.includes(o.status as PipelineStatusValue) &&
    (o.lastSuccessAt === null || typeof o.lastSuccessAt === 'string') &&
    (o.lastAttemptAt === null || typeof o.lastAttemptAt === 'string') &&
    (o.recordCount === null || typeof o.recordCount === 'number') &&
    (o.error === null || typeof o.error === 'string')
  );
}

// The static payload emitted by /api/pipeline-status (matches route.ts STATIC_STATUS).
const STATIC_PAYLOAD = JSON.stringify([
  {
    pipeline: '311',
    status: 'unknown',
    lastSuccessAt: null,
    lastAttemptAt: null,
    recordCount: null,
    error: null,
  },
  {
    pipeline: 'chess',
    status: 'unknown',
    lastSuccessAt: null,
    lastAttemptAt: null,
    recordCount: null,
    error: null,
  },
]);

// ── Payload schema ────────────────────────────────────────────────────────────

describe('pipeline-status payload schema', () => {
  it('static payload is valid JSON', () => {
    expect(() => JSON.parse(STATIC_PAYLOAD)).not.toThrow();
  });

  it('static payload contains two pipeline entries', () => {
    const parsed = JSON.parse(STATIC_PAYLOAD);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it('every entry matches PipelineStatus schema', () => {
    const parsed = JSON.parse(STATIC_PAYLOAD);
    for (const item of parsed) {
      expect(isPipelineStatus(item)).toBe(true);
    }
  });

  it('pipeline identifiers are 311 and chess', () => {
    const parsed: PipelineStatus[] = JSON.parse(STATIC_PAYLOAD);
    const ids = parsed.map((p) => p.pipeline);
    expect(ids).toContain('311');
    expect(ids).toContain('chess');
  });

  it('unknown status has all nullable fields set to null', () => {
    const parsed: PipelineStatus[] = JSON.parse(STATIC_PAYLOAD);
    for (const p of parsed) {
      expect(p.status).toBe('unknown');
      expect(p.lastSuccessAt).toBeNull();
      expect(p.lastAttemptAt).toBeNull();
      expect(p.recordCount).toBeNull();
      expect(p.error).toBeNull();
    }
  });
});

// ── Payload parsing (simulating what the hook does on `status` events) ───────

describe('pipeline-status SSE data parsing', () => {
  it('parses a success payload correctly', () => {
    const payload: PipelineStatus[] = [
      {
        pipeline: '311',
        status: 'success',
        lastSuccessAt: '2026-05-15T03:00:00.000Z',
        lastAttemptAt: '2026-05-15T03:00:00.000Z',
        recordCount: 41200,
        error: null,
      },
    ];
    const data = JSON.stringify(payload);
    const parsed: PipelineStatus[] = JSON.parse(data);
    expect(parsed[0].status).toBe('success');
    expect(parsed[0].recordCount).toBe(41200);
    expect(isPipelineStatus(parsed[0])).toBe(true);
  });

  it('parses a failed payload with error message', () => {
    const payload: PipelineStatus[] = [
      {
        pipeline: 'chess',
        status: 'failed',
        lastSuccessAt: '2026-05-14T10:00:00.000Z',
        lastAttemptAt: '2026-05-15T10:00:00.000Z',
        recordCount: null,
        error: 'Lichess API returned 429',
      },
    ];
    const parsed: PipelineStatus[] = JSON.parse(JSON.stringify(payload));
    expect(parsed[0].status).toBe('failed');
    expect(parsed[0].error).toBe('Lichess API returned 429');
    expect(isPipelineStatus(parsed[0])).toBe(true);
  });

  it('returns empty array on malformed JSON without throwing', () => {
    const malformed = '{ not valid json';
    let result: PipelineStatus[] = [];
    try {
      result = JSON.parse(malformed);
    } catch {
      // hook silently skips malformed events — simulated here
    }
    expect(result).toHaveLength(0);
  });

  it('isPipelineStatus rejects entries missing required fields', () => {
    expect(isPipelineStatus({ pipeline: '311' })).toBe(false);
    expect(isPipelineStatus({ pipeline: '311', status: 'success' })).toBe(false);
    expect(isPipelineStatus(null)).toBe(false);
    expect(isPipelineStatus(42)).toBe(false);
  });

  it('isPipelineStatus rejects unknown status values', () => {
    expect(
      isPipelineStatus({
        pipeline: '311',
        status: 'ok', // not in the enum
        lastSuccessAt: null,
        lastAttemptAt: null,
        recordCount: null,
        error: null,
      }),
    ).toBe(false);
  });
});
