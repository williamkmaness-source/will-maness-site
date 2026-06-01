import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCloudEval } from './cloudEval';
import type { CloudEvalResult } from './cloudEval';

const SAMPLE_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const SAMPLE_RESULT: CloudEvalResult = {
  fen: SAMPLE_FEN,
  depth: 35,
  knodes: 1234,
  pvs: [
    { moves: 'e7e5 g1f3', cp: -20 },
    { moves: 'c7c5 g1f3', cp: -30 },
  ],
};

// Mock global fetch before each test so the cache is fresh.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  // Reset the module-level cache between tests by reimporting.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCloudEval', () => {
  it('returns parsed result on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(SAMPLE_RESULT),
    } as unknown as Response);

    const { fetchCloudEval: fn } = await import('./cloudEval');
    const result = await fn(SAMPLE_FEN);
    expect(result).toEqual(SAMPLE_RESULT);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('cloud-eval'),
      expect.objectContaining({}),
    );
  });

  it('returns null when the API returns a non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as unknown as Response);

    const { fetchCloudEval: fn } = await import('./cloudEval');
    const result = await fn(SAMPLE_FEN);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network failure'));

    const { fetchCloudEval: fn } = await import('./cloudEval');
    const result = await fn(SAMPLE_FEN);
    expect(result).toBeNull();
  });

  it('caches the result and avoids duplicate fetches', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SAMPLE_RESULT),
    } as unknown as Response);

    const { fetchCloudEval: fn } = await import('./cloudEval');
    const r1 = await fn(SAMPLE_FEN);
    const r2 = await fn(SAMPLE_FEN);

    expect(r1).toEqual(SAMPLE_RESULT);
    expect(r2).toEqual(SAMPLE_RESULT);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('caches null for 404 responses and skips re-fetch', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    const { fetchCloudEval: fn } = await import('./cloudEval');
    await fn(SAMPLE_FEN);
    await fn(SAMPLE_FEN);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
