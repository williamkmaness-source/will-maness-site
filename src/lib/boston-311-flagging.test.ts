import { describe, it, expect } from "vitest";
import { flagDepartment, type WeeklyMetrics } from "./boston-311-flagging";

function w(
  week: string,
  opened: number,
  closed: number,
  medianDays: number
): WeeklyMetrics {
  return { week, opened, closed, medianDays };
}

// Helper to produce a stressed week relative to a previous one.
// Guarantees both conditions: opened > closed AND medianDays > prev.medianDays.
function stressed(week: string, prevMedian: number): WeeklyMetrics {
  return w(week, 120, 100, prevMedian + 1.5);
}

// Helper to produce an unstressed week (closed >= opened AND median stable/down).
function calm(week: string, prevMedian: number): WeeklyMetrics {
  return w(week, 90, 110, prevMedian - 0.5);
}

describe("flagDepartment — green cases", () => {
  it("returns green for empty input", () => {
    expect(flagDepartment([])).toEqual({ status: "green", tooltip: "" });
  });

  it("returns green for a single week (no prior week to compare)", () => {
    // Even an extreme week can't be stressed without a prior week.
    expect(flagDepartment([w("2026-01-05", 200, 50, 20)])).toEqual({
      status: "green",
      tooltip: "",
    });
  });

  it("returns green when no weeks are stressed", () => {
    const weeks = [
      w("2026-01-05", 100, 110, 5.0),
      w("2026-01-12", 90, 100, 4.5),
      w("2026-01-19", 80, 90, 4.0),
    ];
    const result = flagDepartment(weeks);
    expect(result.status).toBe("green");
    expect(result.tooltip).toBe("");
  });

  it("returns green when only the backlog condition holds (median stable)", () => {
    // opened > closed, but medianDays did not increase.
    const weeks = [
      w("2026-01-05", 100, 90, 5.0),
      w("2026-01-12", 110, 100, 5.0), // median unchanged
    ];
    const result = flagDepartment(weeks);
    expect(result.status).toBe("green");
    expect(result.tooltip).toBe("");
  });

  it("returns green when only the median condition holds (backlog shrinking)", () => {
    // medianDays went up, but closed >= opened.
    const weeks = [
      w("2026-01-05", 100, 100, 5.0),
      w("2026-01-12", 90, 110, 6.5), // median up but closed > opened
    ];
    const result = flagDepartment(weeks);
    expect(result.status).toBe("green");
    expect(result.tooltip).toBe("");
  });
});

describe("flagDepartment — yellow cases", () => {
  it("returns yellow on exactly 1 consecutive stressed week", () => {
    const weeks = [
      w("2026-01-05", 100, 110, 5.0), // not stressed (first week)
      w("2026-01-12", 120, 100, 6.5), // stressed: opened > closed, median up
    ];
    const result = flagDepartment(weeks);
    expect(result.status).toBe("yellow");
    expect(result.tooltip.length).toBeGreaterThan(0);
  });

  it("returns yellow after a full reset: 2 stressed → 1 calm → 1 stressed", () => {
    const weeks = [
      w("2026-01-05", 100, 90, 5.0),    // first week — never stressed
      stressed("2026-01-12", 5.0),       // stressed #1
      stressed("2026-01-19", 6.5),       // stressed #2 → run of 2 (would be red here)
      calm("2026-01-26", 8.0),           // calm → counter resets to 0
      stressed("2026-02-02", 7.5),       // stressed → run of 1
    ];
    const result = flagDepartment(weeks);
    expect(result.status).toBe("yellow");
  });
});

describe("flagDepartment — red cases", () => {
  it("returns red on exactly 2 consecutive stressed weeks", () => {
    const weeks = [
      w("2026-01-05", 100, 110, 5.0),
      w("2026-01-12", 120, 100, 6.5), // stressed #1
      w("2026-01-19", 130, 110, 7.5), // stressed #2
    ];
    const result = flagDepartment(weeks);
    expect(result.status).toBe("red");
    expect(result.tooltip.length).toBeGreaterThan(0);
  });

  it("returns red on 3 consecutive stressed weeks", () => {
    const weeks = [
      w("2026-01-05", 100, 110, 5.0),
      w("2026-01-12", 120, 100, 6.0), // stressed #1
      w("2026-01-19", 130, 110, 7.0), // stressed #2
      w("2026-01-26", 140, 120, 8.5), // stressed #3
    ];
    expect(flagDepartment(weeks).status).toBe("red");
  });
});

describe("flagDepartment — reset behavior", () => {
  it("a single calm week resets the counter: stressed → calm → stressed = yellow", () => {
    const weeks = [
      w("2026-01-05", 100, 90, 5.0),
      w("2026-01-12", 120, 100, 6.0), // stressed
      w("2026-01-19", 100, 120, 5.0), // calm (closed > opened, median down)
      w("2026-01-26", 150, 120, 6.0), // stressed again — run of 1
    ];
    expect(flagDepartment(weeks).status).toBe("yellow");
  });

  it("multiple resets: two red runs separated by calm weeks stays yellow if last run is 1", () => {
    const baseMedian = 5.0;
    const weeks = [
      w("2026-01-05", 100, 90, baseMedian),
      stressed("2026-01-12", baseMedian),
      stressed("2026-01-19", baseMedian + 1.5),    // run of 2 → would be red
      calm("2026-01-26", baseMedian + 3.0),
      calm("2026-02-02", baseMedian + 2.5),
      stressed("2026-02-09", baseMedian + 2.0),   // new run of 1
    ];
    expect(flagDepartment(weeks).status).toBe("yellow");
  });
});

describe("flagDepartment — tooltip content", () => {
  it("tooltip is empty string for green", () => {
    const weeks = [w("2026-01-05", 100, 110, 5.0)];
    expect(flagDepartment(weeks).tooltip).toBe("");
  });

  it("yellow tooltip references 1 week", () => {
    const weeks = [
      w("2026-01-05", 100, 110, 5.0),
      w("2026-01-12", 130, 100, 6.5), // stressed
    ];
    const { tooltip } = flagDepartment(weeks);
    expect(tooltip).toMatch(/over 1 week[^s]/); // "week" not "weeks"
    expect(tooltip).toMatch(/Backlog up \d+%/);
    expect(tooltip).toMatch(/median closure time up \d+ day/);
  });

  it("red tooltip references N weeks (plural)", () => {
    const weeks = [
      w("2026-01-05", 100, 110, 5.0),
      w("2026-01-12", 130, 100, 6.5), // stressed #1
      w("2026-01-19", 140, 110, 8.0), // stressed #2
    ];
    const { tooltip } = flagDepartment(weeks);
    expect(tooltip).toMatch(/over 2 weeks/);
    expect(tooltip).toMatch(/Backlog up \d+%/);
    expect(tooltip).toMatch(/median closure time up \d+ day/);
  });

  it("tooltip backlog percentage is computed correctly", () => {
    // opened=130, closed=100 → (30/100)*100 = 30%
    const weeks = [
      w("2026-01-05", 100, 110, 5.0),
      w("2026-01-12", 130, 100, 6.5),
    ];
    const { tooltip } = flagDepartment(weeks);
    expect(tooltip).toMatch(/Backlog up 30%/);
  });

  it("tooltip median increase is computed from the week before the run", () => {
    // medianBefore = 5.0 (week[0]), medianAfter = 6.5 → increase = 2 (rounded from 1.5)
    const weeks = [
      w("2026-01-05", 100, 110, 5.0),
      w("2026-01-12", 130, 100, 6.5),
    ];
    const { tooltip } = flagDepartment(weeks);
    expect(tooltip).toMatch(/median closure time up 2 day/);
  });
});
