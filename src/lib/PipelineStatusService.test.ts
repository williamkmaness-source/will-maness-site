import { describe, it, expect, vi } from "vitest";
import {
  buildRunStatus,
  buildVendorFeedStatus,
  getPipelineStatuses,
} from "./PipelineStatusService";

// ── buildRunStatus ────────────────────────────────────────────────────────────

describe("buildRunStatus", () => {
  it("maps a success row correctly", () => {
    const row = {
      pipeline: "311",
      status: "success",
      last_success_at: "2026-05-15T03:00:00Z",
      last_attempt_at: "2026-05-15T03:00:00Z",
      record_count: 41200,
      error: null,
    };
    const result = buildRunStatus(row);
    expect(result).toEqual({
      pipeline: "311",
      status: "success",
      lastSuccessAt: "2026-05-15T03:00:00Z",
      lastAttemptAt: "2026-05-15T03:00:00Z",
      recordCount: 41200,
      error: null,
    });
  });

  it("maps a failed row with error message", () => {
    const row = {
      pipeline: "311",
      status: "failed",
      last_success_at: "2026-05-14T10:00:00Z",
      last_attempt_at: "2026-05-15T10:00:00Z",
      record_count: null,
      error: "Lichess API returned 429",
    };
    const result = buildRunStatus(row);
    expect(result.status).toBe("failed");
    expect(result.error).toBe("Lichess API returned 429");
    expect(result.lastSuccessAt).toBe("2026-05-14T10:00:00Z");
    expect(result.recordCount).toBeNull();
  });
});

// ── buildVendorFeedStatus ─────────────────────────────────────────────────────

describe("buildVendorFeedStatus", () => {
  it("returns unknown for null row", () => {
    expect(buildVendorFeedStatus(null)).toEqual({
      pipeline: "vendor-feed",
      status: "unknown",
      lastSuccessAt: null,
      lastAttemptAt: null,
      recordCount: null,
      error: null,
    });
  });

  it("returns success when extracted > 0", () => {
    const row = {
      extracted: "87",
      pending: "0",
      failed: "0",
      last_success_at: "2026-05-22T09:00:00Z",
      last_attempt_at: "2026-05-22T09:00:00Z",
    };
    const result = buildVendorFeedStatus(row);
    expect(result.status).toBe("success");
    expect(result.recordCount).toBe(87);
    expect(result.error).toBeNull();
  });

  it("returns failed when only failed rows exist", () => {
    const row = {
      extracted: "0",
      pending: "0",
      failed: "3",
      last_success_at: null,
      last_attempt_at: "2026-05-22T09:00:00Z",
    };
    const result = buildVendorFeedStatus(row);
    expect(result.status).toBe("failed");
    expect(result.recordCount).toBeNull();
    expect(result.error).toBe("3 pages failed");
  });

  it("surfaces failed count as error even when extracted > 0", () => {
    const row = {
      extracted: "80",
      pending: "0",
      failed: "2",
      last_success_at: "2026-05-22T09:00:00Z",
      last_attempt_at: "2026-05-22T09:00:00Z",
    };
    const result = buildVendorFeedStatus(row);
    expect(result.status).toBe("success");
    expect(result.error).toBe("2 pages failed");
  });

  it("uses singular 'page' for exactly one failure", () => {
    const row = {
      extracted: "0",
      pending: "0",
      failed: "1",
      last_success_at: null,
      last_attempt_at: "2026-05-22T09:00:00Z",
    };
    expect(buildVendorFeedStatus(row).error).toBe("1 page failed");
  });

  it("returns running when only pending pages exist", () => {
    const row = {
      extracted: "0",
      pending: "5",
      failed: "0",
      last_success_at: null,
      last_attempt_at: "2026-05-22T09:00:00Z",
    };
    const result = buildVendorFeedStatus(row);
    expect(result.status).toBe("running");
    expect(result.recordCount).toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns unknown when all counts are zero", () => {
    const row = {
      extracted: "0",
      pending: "0",
      failed: "0",
      last_success_at: null,
      last_attempt_at: null,
    };
    expect(buildVendorFeedStatus(row).status).toBe("unknown");
  });
});

// ── getPipelineStatuses ───────────────────────────────────────────────────────

describe("getPipelineStatuses", () => {
  it("maps pipeline_runs rows and vf_raw_pages into two status entries", async () => {
    const runRows = [
      {
        pipeline: "311",
        status: "success",
        last_success_at: "2026-05-22T03:00:00Z",
        last_attempt_at: "2026-05-22T03:00:00Z",
        record_count: 95000,
        error: null,
      },
    ];
    const vfRows = [
      {
        extracted: "87",
        pending: "0",
        failed: "0",
        last_success_at: "2026-05-22T09:00:00Z",
        last_attempt_at: "2026-05-22T09:00:00Z",
      },
    ];

    const mockSql = vi.fn()
      .mockResolvedValueOnce(runRows)
      .mockResolvedValueOnce(vfRows);

    const result = await getPipelineStatuses(mockSql as never);

    expect(result).toHaveLength(2);
    expect(result[0].pipeline).toBe("311");
    expect(result[0].status).toBe("success");
    expect(result[1].pipeline).toBe("vendor-feed");
    expect(result[1].recordCount).toBe(87);
  });

  it("returns unknown for 311 when pipeline_runs is empty", async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([])        // empty pipeline_runs
      .mockResolvedValueOnce([{
        extracted: "0",
        pending: "0",
        failed: "0",
        last_success_at: null,
        last_attempt_at: null,
      }]);

    const result = await getPipelineStatuses(mockSql as never);

    expect(result[0]).toEqual({
      pipeline: "311",
      status: "unknown",
      lastSuccessAt: null,
      lastAttemptAt: null,
      recordCount: null,
      error: null,
    });
  });

  it("handles empty vf_raw_pages gracefully", async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getPipelineStatuses(mockSql as never);
    expect(result[1]).toEqual({
      pipeline: "vendor-feed",
      status: "unknown",
      lastSuccessAt: null,
      lastAttemptAt: null,
      recordCount: null,
      error: null,
    });
  });
});
