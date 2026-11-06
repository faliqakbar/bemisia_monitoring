import type { Settings } from "../types";
export function bemisiaPerDay(count: number, days: number | null) {
  return days !== null && Number.isFinite(days) && days > 0
    ? count / days
    : null;
}
export function percentChange(current: number, previous: number | null) {
  return previous === null || previous === 0
    ? null
    : ((current - previous) / previous) * 100;
}
export function calculateTrend(
  count: number,
  days: number | null,
  previous?: {
    bemisia_count: number;
    bemisia_per_day: number | null;
    exposure_days: number | null;
    model_version?: string;
  },
  modelVersion?: string,
) {
  // A change of weights (including mock -> real) starts a new baseline.
  if (modelVersion && previous?.model_version !== modelVersion)
    previous = undefined;
  const rate = bemisiaPerDay(count, days),
    previousRate = previous?.bemisia_per_day ?? null;
  const change = percentChange(count, previous?.bemisia_count ?? null),
    rateChange = rate === null ? null : percentChange(rate, previousRate);
  return {
    previous_count: previous?.bemisia_count ?? null,
    count_difference: previous ? count - previous.bemisia_count : null,
    percent_change: change,
    bemisia_per_day: rate,
    previous_bemisia_per_day: previousRate,
    rate_change_percent: rateChange,
  };
}
// Latest earlier observation of the trap made with the same model weights.
export function findBaseline<
  T extends { trap_id: string; captured_at: string; model_version: string },
>(sessions: T[], trapId: string, capturedAt: string, modelVersion: string) {
  return sessions
    .filter(
      (s) =>
        s.trap_id === trapId &&
        s.captured_at < capturedAt &&
        s.model_version === modelVersion,
    )
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
}
// Chart series limited to the newest model version, oldest first.
export function chartSeries<
  T extends { captured_at: string; model_version: string },
>(sessions: T[], limit = 12) {
  const sorted = [...sessions].sort((a, b) =>
      a.captured_at.localeCompare(b.captured_at),
    ),
    version = sorted.at(-1)?.model_version,
    same = sorted.filter((s) => s.model_version === version);
  return {
    version,
    points: same.slice(-limit),
    hidden: sorted.length - same.length,
  };
}
export function comparableChange(
  session: {
    rate_change_percent: number | null;
    percent_change: number | null;
    exposure_days: number | null;
  },
  previousDays: number | null,
) {
  return (
    session.rate_change_percent ??
    (session.exposure_days !== null && session.exposure_days === previousDays
      ? session.percent_change
      : null)
  );
}
export function trendStatus(
  change: number | null,
  settings: Pick<Settings, "watchThreshold" | "highThreshold">,
): "HIGH" | "WATCH" | "NORMAL" | "UNKNOWN" {
  return change === null
    ? "UNKNOWN"
    : change > settings.highThreshold
      ? "HIGH"
      : change >= settings.watchThreshold
        ? "WATCH"
        : "NORMAL";
}
