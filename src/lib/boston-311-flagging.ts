export interface WeeklyMetrics {
  week: string;
  opened: number;
  closed: number;
  medianDays: number;
}

export interface FlagResult {
  status: 'green' | 'yellow' | 'red';
  tooltip: string;
}

// Weights and thresholds for the flagging algorithm.
const YELLOW_THRESHOLD = 1;
const RED_THRESHOLD = 2;

/**
 * A week is "stressed" when backlog is growing (opened > closed) AND
 * median closure time increased compared to the prior week.
 * The first week is never stressed — there is no prior week for comparison.
 */
function isStressed(week: WeeklyMetrics, prev: WeeklyMetrics): boolean {
  return week.opened > week.closed && week.medianDays > prev.medianDays;
}

/**
 * Determines the staffing pressure status for a department given 12 weeks of metrics.
 * Status is based on the length of the *current* consecutive stressed-week run at the
 * end of the window — a non-stressed week resets the counter.
 *
 * Green  — 0 consecutive stressed weeks
 * Yellow — exactly 1 consecutive stressed week
 * Red    — 2+ consecutive stressed weeks
 */
export function flagDepartment(weeks: WeeklyMetrics[]): FlagResult {
  if (weeks.length === 0) return { status: 'green', tooltip: '' };

  // Compute the length and start index of the current consecutive stressed run.
  let runLength = 0;
  let runStartIdx = weeks.length; // sentinel — only meaningful when runLength > 0

  for (let i = 1; i < weeks.length; i++) {
    if (isStressed(weeks[i], weeks[i - 1])) {
      if (runLength === 0) runStartIdx = i;
      runLength++;
    } else {
      runLength = 0;
      runStartIdx = weeks.length;
    }
  }

  let status: 'green' | 'yellow' | 'red';
  if (runLength < YELLOW_THRESHOLD) status = 'green';
  else if (runLength < RED_THRESHOLD) status = 'yellow';
  else status = 'red';

  if (status === 'green') return { status, tooltip: '' };

  // Build tooltip from the current stressed run.
  const stressedSlice = weeks.slice(runStartIdx, runStartIdx + runLength);
  const totalOpened = stressedSlice.reduce((s, w) => s + w.opened, 0);
  const totalClosed = stressedSlice.reduce((s, w) => s + w.closed, 0);

  const backlogPct =
    totalClosed > 0
      ? Math.round(((totalOpened - totalClosed) / totalClosed) * 100)
      : 100;

  // Median increase is measured from the week *before* the run to the run's last week.
  const medianBefore = weeks[runStartIdx - 1].medianDays;
  const medianAfter = stressedSlice[stressedSlice.length - 1].medianDays;
  const medianIncrease = Math.round(medianAfter - medianBefore);

  const weekWord = runLength === 1 ? 'week' : 'weeks';
  const dayWord = medianIncrease === 1 ? 'day' : 'days';
  const tooltip = `Backlog up ${backlogPct}% over ${runLength} ${weekWord}, median closure time up ${medianIncrease} ${dayWord}.`;

  return { status, tooltip };
}
