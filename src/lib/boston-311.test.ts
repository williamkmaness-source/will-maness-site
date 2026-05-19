import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  assertIsoDate,
  toDateStr,
  median,
  inWindow,
  prepareCaseEvent,
  batchUpsertCaseEvents,
  UPSERT_BATCH_SIZE,
  computeWindow,
  mergeWindows,
  aggregateGroup,
  fetchFromResource,
  fetchWindow,
  type RawRow,
  type RawCaseRow,
  type CaseEventRecord,
} from "./boston-311";

// --- assertIsoDate ---

describe("assertIsoDate", () => {
  it("passes valid YYYY-MM-DD strings through", () => {
    expect(assertIsoDate("2024-01-01")).toBe("2024-01-01");
    expect(assertIsoDate("2026-12-31")).toBe("2026-12-31");
  });

  it("rejects strings with SQL injection payloads", () => {
    expect(() => assertIsoDate("2024-01-01'; DROP TABLE --")).toThrow(
      "Invalid ISO date string"
    );
  });

  it("rejects strings with extra characters after the date", () => {
    expect(() => assertIsoDate("2024-01-01T00:00:00Z")).toThrow(
      "Invalid ISO date string"
    );
  });

  it("rejects empty strings", () => {
    expect(() => assertIsoDate("")).toThrow("Invalid ISO date string");
  });

  it("rejects malformed date formats", () => {
    expect(() => assertIsoDate("01-01-2024")).toThrow("Invalid ISO date string");
    expect(() => assertIsoDate("2024/01/01")).toThrow("Invalid ISO date string");
    expect(() => assertIsoDate("2024-1-1")).toThrow("Invalid ISO date string");
  });
});

// --- toDateStr ---

describe("toDateStr", () => {
  it("converts Date to YYYY-MM-DD", () => {
    const d = new Date("2024-06-15T12:00:00Z");
    expect(toDateStr(d)).toBe("2024-06-15");
  });

  it("always produces a valid ISO date (passes assertIsoDate)", () => {
    const dates = [new Date(0), new Date(), new Date("2030-12-31")];
    for (const d of dates) {
      expect(() => assertIsoDate(toDateStr(d))).not.toThrow();
    }
  });
});

// --- median ---

describe("median", () => {
  it("returns null for empty array", () => {
    expect(median([])).toBeNull();
  });

  it("returns the middle value for odd-length arrays", () => {
    expect(median([1, 3, 5])).toBe(3);
    expect(median([10])).toBe(10);
  });

  it("returns the average of two middle values for even-length arrays", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 3])).toBe(2);
  });

  it("handles unsorted input correctly", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([9, 1, 4, 2])).toBe(3);
  });
});

// --- inWindow ---

describe("inWindow", () => {
  const start = new Date("2024-01-01").getTime();
  const end = new Date("2024-01-31").getTime();

  it("returns true for dates within the window", () => {
    expect(inWindow("2024-01-15T00:00:00Z", start, end)).toBe(true);
  });

  it("returns true for dates at exact boundaries", () => {
    expect(inWindow("2024-01-01T00:00:00.000Z", start, end)).toBe(true);
    expect(inWindow("2024-01-31T00:00:00.000Z", start, end)).toBe(true);
  });

  it("returns false for dates outside the window", () => {
    expect(inWindow("2023-12-31T23:59:59Z", start, end)).toBe(false);
    expect(inWindow("2024-02-01T00:00:01Z", start, end)).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(inWindow(null, start, end)).toBe(false);
    expect(inWindow(undefined, start, end)).toBe(false);
  });

  it("returns false for invalid date strings", () => {
    expect(inWindow("not-a-date", start, end)).toBe(false);
  });
});

// --- prepareCaseEvent ---

describe("prepareCaseEvent", () => {
  const validRow: RawCaseRow = {
    case_enquiry_id: "101004321",
    neighborhood: "Dorchester",
    reason: "Street Cleaning",
    subject: "PWD",
    open_dt: "2024-03-15T00:00:00",
    closed_dt: "2024-03-18T00:00:00",
    on_time: "ONTIME",
    sla_target_dt: "2024-03-20T00:00:00",
  };

  it("converts a valid raw row to a CaseEventRecord", () => {
    const result = prepareCaseEvent(validRow);
    expect(result).not.toBeNull();
    expect(result!.case_id).toBe("101004321");
    expect(result!.neighborhood).toBe("Dorchester");
    expect(result!.request_type).toBe("Street Cleaning");
    expect(result!.department).toBe("PWD");
    expect(result!.open_date).toBe("2024-03-15");
    expect(result!.close_date).toBe("2024-03-18");
    expect(result!.on_time).toBe(true);
  });

  it("computes days_to_close correctly", () => {
    const result = prepareCaseEvent(validRow);
    expect(result!.days_to_close).toBe(3);
  });

  it("computes sla_days correctly", () => {
    const result = prepareCaseEvent(validRow);
    expect(result!.sla_days).toBe(5);
  });

  it("returns null when case_enquiry_id is missing", () => {
    expect(prepareCaseEvent({ ...validRow, case_enquiry_id: null })).toBeNull();
    expect(prepareCaseEvent({ ...validRow, case_enquiry_id: undefined })).toBeNull();
  });

  it("returns null when neighborhood is empty/whitespace", () => {
    expect(prepareCaseEvent({ ...validRow, neighborhood: "" })).toBeNull();
    expect(prepareCaseEvent({ ...validRow, neighborhood: "   " })).toBeNull();
    expect(prepareCaseEvent({ ...validRow, neighborhood: null })).toBeNull();
  });

  it("returns null when open_dt is missing", () => {
    expect(prepareCaseEvent({ ...validRow, open_dt: null })).toBeNull();
  });

  it("trims neighborhood whitespace", () => {
    const result = prepareCaseEvent({ ...validRow, neighborhood: "  Roxbury  " });
    expect(result!.neighborhood).toBe("Roxbury");
  });

  it("defaults request_type to 'Unknown' when reason is null", () => {
    const result = prepareCaseEvent({ ...validRow, reason: null });
    expect(result!.request_type).toBe("Unknown");
  });

  it("sets department to null when subject is missing", () => {
    const result = prepareCaseEvent({ ...validRow, subject: null });
    expect(result!.department).toBeNull();
  });

  it("handles OVERDUE on_time value", () => {
    const result = prepareCaseEvent({ ...validRow, on_time: "OVERDUE" });
    expect(result!.on_time).toBe(false);
  });

  it("sets on_time to null for unknown values", () => {
    const result = prepareCaseEvent({ ...validRow, on_time: "UNKNOWN" });
    expect(result!.on_time).toBeNull();
  });

  it("sets days_to_close to null when closed_dt is missing", () => {
    const result = prepareCaseEvent({ ...validRow, closed_dt: null });
    expect(result!.days_to_close).toBeNull();
    expect(result!.close_date).toBeNull();
  });

  it("sets days_to_close to null when close is before open (negative diff)", () => {
    const result = prepareCaseEvent({
      ...validRow,
      open_dt: "2024-03-18T00:00:00",
      closed_dt: "2024-03-15T00:00:00",
    });
    expect(result!.days_to_close).toBeNull();
  });

  it("sets sla_days to null when sla_target_dt is missing", () => {
    const result = prepareCaseEvent({ ...validRow, sla_target_dt: null });
    expect(result!.sla_days).toBeNull();
  });
});

// --- batchUpsertCaseEvents ---

describe("batchUpsertCaseEvents", () => {
  let mockSql: ReturnType<typeof vi.fn> & { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const fn = vi.fn().mockResolvedValue([]) as typeof mockSql;
    fn.query = vi.fn().mockResolvedValue([]);
    mockSql = fn;
  });

  it("returns 0 for empty records array without calling sql", async () => {
    const result = await batchUpsertCaseEvents(mockSql as any, []);
    expect(result).toBe(0);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("sends a single batch for records <= UPSERT_BATCH_SIZE", async () => {
    const records: CaseEventRecord[] = Array.from({ length: 5 }, (_, i) => ({
      case_id: `case-${i}`,
      neighborhood: "Dorchester",
      request_type: "Street Cleaning",
      department: "PWD",
      open_date: "2024-03-15",
      close_date: "2024-03-18",
      days_to_close: 3,
      on_time: true,
      sla_days: 5,
    }));

    const result = await batchUpsertCaseEvents(mockSql as any, records);
    expect(result).toBe(5);
    expect(mockSql.query).toHaveBeenCalledTimes(1);
  });

  it("splits into multiple batches for large record sets", async () => {
    const records: CaseEventRecord[] = Array.from(
      { length: UPSERT_BATCH_SIZE + 50 },
      (_, i) => ({
        case_id: `case-${i}`,
        neighborhood: "Allston",
        request_type: "Pothole",
        department: null,
        open_date: "2024-06-01",
        close_date: null,
        days_to_close: null,
        on_time: null,
        sla_days: null,
      })
    );

    const result = await batchUpsertCaseEvents(mockSql as any, records);
    expect(result).toBe(UPSERT_BATCH_SIZE + 50);
    expect(mockSql.query).toHaveBeenCalledTimes(2);
  });

  it("passes correctly indexed $N params in the SQL", async () => {
    const records: CaseEventRecord[] = [
      {
        case_id: "abc",
        neighborhood: "Brighton",
        request_type: "Graffiti",
        department: "DPW",
        open_date: "2024-01-10",
        close_date: "2024-01-12",
        days_to_close: 2,
        on_time: false,
        sla_days: 3,
      },
    ];

    await batchUpsertCaseEvents(mockSql as any, records);

    const [query, params] = mockSql.query.mock.calls[0];
    expect(query).toContain("INSERT INTO case_events");
    expect(query).toContain("ON CONFLICT (case_id) DO UPDATE");
    expect(query).toContain("$1");
    expect(query).toContain("$9");
    expect(params).toEqual([
      "abc", "Brighton", "Graffiti", "DPW",
      "2024-01-10", "2024-01-12", 2, false, 3,
    ]);
  });

  it("handles null values in params correctly", async () => {
    const records: CaseEventRecord[] = [
      {
        case_id: "xyz",
        neighborhood: "Jamaica Plain",
        request_type: "Unknown",
        department: null,
        open_date: "2024-05-01",
        close_date: null,
        days_to_close: null,
        on_time: null,
        sla_days: null,
      },
    ];

    await batchUpsertCaseEvents(mockSql as any, records);

    const [, params] = mockSql.query.mock.calls[0];
    expect(params[3]).toBeNull(); // department
    expect(params[5]).toBeNull(); // close_date
    expect(params[6]).toBeNull(); // days_to_close
    expect(params[7]).toBeNull(); // on_time
    expect(params[8]).toBeNull(); // sla_days
  });
});

// --- aggregateGroup ---

describe("aggregateGroup", () => {
  const windowStart = new Date("2024-01-01").getTime();
  const windowEnd = new Date("2024-01-31").getTime();

  const closedRows: RawRow[] = [
    {
      neighborhood: "Dorchester",
      reason: "Pothole",
      case_status: "Closed",
      open_dt: "2024-01-05T00:00:00",
      closed_dt: "2024-01-10T00:00:00",
      on_time: "ONTIME",
    },
    {
      neighborhood: "Dorchester",
      reason: "Pothole",
      case_status: "Closed",
      open_dt: "2024-01-08T00:00:00",
      closed_dt: "2024-01-14T00:00:00",
      on_time: "OVERDUE",
    },
    {
      neighborhood: "Roxbury",
      reason: "Pothole",
      case_status: "Closed",
      open_dt: "2024-01-02T00:00:00",
      closed_dt: "2024-01-04T00:00:00",
      on_time: "ONTIME",
    },
  ];

  it("computes median days per neighborhood", () => {
    const result = aggregateGroup(closedRows, windowStart, windowEnd);
    const dorchester = result.neighborhoods.get("Dorchester");
    // Dorchester: (5 + 6) / 2 = 5.5 days median
    expect(dorchester!.medianDays).toBe(5.5);
    // Roxbury: 2 days
    const roxbury = result.neighborhoods.get("Roxbury");
    expect(roxbury!.medianDays).toBe(2);
  });

  it("computes on-time rate per neighborhood", () => {
    const result = aggregateGroup(closedRows, windowStart, windowEnd);
    const dorchester = result.neighborhoods.get("Dorchester");
    expect(dorchester!.onTimeRate).toBe(0.5); // 1/2
    const roxbury = result.neighborhoods.get("Roxbury");
    expect(roxbury!.onTimeRate).toBe(1); // 1/1
  });

  it("computes city-wide median", () => {
    const result = aggregateGroup(closedRows, windowStart, windowEnd);
    // All days: [5, 6, 2] → sorted [2, 5, 6] → median = 5
    expect(result.cityMedian).toBe(5);
  });

  it("computes equity gap (worst / best neighborhood median)", () => {
    const result = aggregateGroup(closedRows, windowStart, windowEnd);
    // worst = 5.5, best = 2 → gap = 5.5 / 2 = 2.75
    expect(result.equityGap).toBe(2.75);
  });

  it("counts total closed cases", () => {
    const result = aggregateGroup(closedRows, windowStart, windowEnd);
    expect(result.totalCases).toBe(3);
  });

  it("excludes non-closed cases from median/on-time but counts opened/closed", () => {
    const mixedRows: RawRow[] = [
      ...closedRows,
      {
        neighborhood: "Dorchester",
        reason: "Pothole",
        case_status: "Open",
        open_dt: "2024-01-20T00:00:00",
        closed_dt: null,
        on_time: null,
      },
    ];
    const result = aggregateGroup(mixedRows, windowStart, windowEnd);
    expect(result.totalCases).toBe(3); // only closed
    const dorchester = result.neighborhoods.get("Dorchester");
    expect(dorchester!.openedCount).toBe(3); // 2 closed + 1 open
  });

  it("handles empty input", () => {
    const result = aggregateGroup([], windowStart, windowEnd);
    expect(result.totalCases).toBe(0);
    expect(result.cityMedian).toBeNull();
    expect(result.equityGap).toBeNull();
    expect(result.neighborhoods.size).toBe(0);
  });

  it("ignores rows with empty neighborhood", () => {
    const rows: RawRow[] = [
      {
        neighborhood: "",
        reason: "Test",
        case_status: "Closed",
        open_dt: "2024-01-05T00:00:00",
        closed_dt: "2024-01-06T00:00:00",
        on_time: "ONTIME",
      },
    ];
    const result = aggregateGroup(rows, windowStart, windowEnd);
    expect(result.totalCases).toBe(0);
  });
});

// --- computeWindow ---

describe("computeWindow", () => {
  const windowStart = new Date("2024-01-01").getTime();
  const windowEnd = new Date("2024-01-31").getTime();

  it("groups rows by request type and includes ALL_CATEGORIES", () => {
    const rows: RawRow[] = [
      {
        neighborhood: "Dorchester",
        reason: "Pothole",
        case_status: "Closed",
        open_dt: "2024-01-05",
        closed_dt: "2024-01-10",
        on_time: "ONTIME",
      },
      {
        neighborhood: "Roxbury",
        reason: "Graffiti",
        case_status: "Closed",
        open_dt: "2024-01-06",
        closed_dt: "2024-01-08",
        on_time: "ONTIME",
      },
    ];

    const result = computeWindow(rows, windowStart, windowEnd);
    expect(result.has("Pothole")).toBe(true);
    expect(result.has("Graffiti")).toBe(true);
    expect(result.has("All categories")).toBe(true);
  });

  it("uses 'Unknown' for rows with null reason", () => {
    const rows: RawRow[] = [
      {
        neighborhood: "Allston",
        reason: null,
        case_status: "Closed",
        open_dt: "2024-01-10",
        closed_dt: "2024-01-12",
        on_time: "ONTIME",
      },
    ];

    const result = computeWindow(rows, windowStart, windowEnd);
    expect(result.has("Unknown")).toBe(true);
  });
});

// --- mergeWindows ---

describe("mergeWindows", () => {
  const windowStart = new Date("2024-01-01").getTime();
  const windowEnd = new Date("2024-01-31").getTime();
  const priorStart = new Date("2023-01-01").getTime();
  const priorEnd = new Date("2023-01-31").getTime();

  it("includes yoyEquityGap from prior window", () => {
    const currentRows: RawRow[] = [
      {
        neighborhood: "Dorchester",
        reason: "Pothole",
        case_status: "Closed",
        open_dt: "2024-01-05",
        closed_dt: "2024-01-10",
        on_time: "ONTIME",
      },
    ];
    const priorRows: RawRow[] = [
      {
        neighborhood: "Dorchester",
        reason: "Pothole",
        case_status: "Closed",
        open_dt: "2023-01-05",
        closed_dt: "2023-01-15",
        on_time: "OVERDUE",
      },
    ];

    const current = computeWindow(currentRows, windowStart, windowEnd);
    const prior = computeWindow(priorRows, priorStart, priorEnd);
    const result = mergeWindows(current, prior);

    const pothole = result.find((r) => r.requestType === "Pothole");
    expect(pothole).toBeDefined();
    expect(pothole!.yoyEquityGap).not.toBeNull();
  });

  it("puts 'All categories' first and sorts rest by totalCases desc", () => {
    const rows: RawRow[] = [
      {
        neighborhood: "Dorchester",
        reason: "Pothole",
        case_status: "Closed",
        open_dt: "2024-01-05",
        closed_dt: "2024-01-10",
        on_time: "ONTIME",
      },
      {
        neighborhood: "Roxbury",
        reason: "Graffiti",
        case_status: "Closed",
        open_dt: "2024-01-06",
        closed_dt: "2024-01-08",
        on_time: "ONTIME",
      },
      {
        neighborhood: "Roxbury",
        reason: "Graffiti",
        case_status: "Closed",
        open_dt: "2024-01-07",
        closed_dt: "2024-01-09",
        on_time: "ONTIME",
      },
    ];

    const current = computeWindow(rows, windowStart, windowEnd);
    const prior = computeWindow([], priorStart, priorEnd);
    const result = mergeWindows(current, prior);

    expect(result[0].requestType).toBe("All categories");
    expect(result[1].requestType).toBe("Graffiti"); // 2 cases
    expect(result[2].requestType).toBe("Pothole"); // 1 case
  });

  it("sets yoyEquityGap to null when prior has no matching type", () => {
    const rows: RawRow[] = [
      {
        neighborhood: "Brighton",
        reason: "NewType",
        case_status: "Closed",
        open_dt: "2024-01-10",
        closed_dt: "2024-01-12",
        on_time: "ONTIME",
      },
    ];

    const current = computeWindow(rows, windowStart, windowEnd);
    const prior = computeWindow([], priorStart, priorEnd);
    const result = mergeWindows(current, prior);

    const newType = result.find((r) => r.requestType === "NewType");
    expect(newType!.yoyEquityGap).toBeNull();
  });
});

// --- fetchFromResource (with mocked fetch) ---

describe("fetchFromResource", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects invalid date strings before making any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      fetchFromResource("some-resource", "2024-01-01'; DROP TABLE --", "2024-01-31")
    ).rejects.toThrow("Invalid ISO date string");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches pages until records < PAGE_SIZE", async () => {
    const mockRecords = Array.from({ length: 10 }, (_, i) => ({
      neighborhood: `N${i}`,
      reason: "Test",
      case_status: "Closed",
      open_dt: "2024-01-05",
      closed_dt: "2024-01-06",
      on_time: "ONTIME",
    }));

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ success: true, result: { records: mockRecords } }),
        { status: 200 }
      )
    );

    const result = await fetchFromResource("res-id", "2024-01-01", "2024-01-31");
    expect(result).toHaveLength(10);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on transient errors with backoff", async () => {
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("Network error");
      }
      return new Response(
        JSON.stringify({ success: true, result: { records: [] } }),
        { status: 200 }
      );
    });

    const promise = fetchFromResource("res-id", "2024-01-01", "2024-01-31");
    // Advance past the backoff timers (2s, 4s) and the abort timeout (20s)
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await promise;
    expect(result).toHaveLength(0);
    expect(callCount).toBe(3);
  });

  it("throws immediately on 4xx without retrying", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404, statusText: "Not Found" })
    );

    await expect(
      fetchFromResource("bad-resource", "2024-01-01", "2024-01-31")
    ).rejects.toThrow("CKAN API responded 404");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("timeout");
    });

    const promise = fetchFromResource("res-id", "2024-01-01", "2024-01-31").catch(
      (e: Error) => e
    );
    await vi.advanceTimersByTimeAsync(30_000);
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("all 3 attempts failed");
  });
});

// --- fetchWindow ---

describe("fetchWindow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("only fetches year resources that overlap the window", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ success: true, result: { records: [] } }),
        { status: 200 }
      )
    );

    // Window in May 2026 — should only touch 2025 and 2026 resources (2025 due to -1 year overlap)
    const start = new Date("2026-05-01");
    const end = new Date("2026-05-31");
    await fetchWindow(start, end);

    // 2025 and 2026 resources = 2 calls
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("returns degraded: true when one resource returns a 4xx error", async () => {
    // 4xx errors are not retried, so this test completes immediately.
    const resource2025 = "9d7c2214-4709-478a-a2e8-fb2020a5bb94";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes(resource2025)) {
        return new Response("Gone", { status: 410, statusText: "Gone" });
      }
      return new Response(
        JSON.stringify({
          success: true,
          result: { records: [{ neighborhood: "Test", reason: "R" }] },
        }),
        { status: 200 }
      );
    });

    const start = new Date("2026-05-01");
    const end = new Date("2026-05-31");
    const result = await fetchWindow(start, end);
    expect(result.degraded).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);
  });
});
