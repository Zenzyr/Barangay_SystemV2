/**
 * Shared date-range options for the Analytics and Decision Support pages.
 * Both pages must offer the same presets and convert them to the same
 * YYYY-MM-DD `from` bound so the backend sees identical windows.
 */

export type AnalyticsRangeKey = "all" | "7d" | "14d" | "30d";

export const ANALYTICS_RANGE_OPTIONS: { key: AnalyticsRangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "30d", label: "Last 30 days" },
  { key: "14d", label: "Last 14 days" },
  { key: "7d", label: "Last 7 days" },
];

export const ANALYTICS_RANGE_DAYS: Record<Exclude<AnalyticsRangeKey, "all">, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
};

/** Formats a Date using its LOCAL Y/M/D so the server does not shift the day. */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local midnight `N` days ago (inclusive of today) for a preset, or null for all time. */
export function rangeStartDate(range: AnalyticsRangeKey): Date | null {
  if (range === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ANALYTICS_RANGE_DAYS[range]);
  return d;
}

/** The `from` query/body bound (YYYY-MM-DD) for a preset; empty object for all time. */
export function rangeQuery(range: AnalyticsRangeKey): { from?: string } {
  const start = rangeStartDate(range);
  return start ? { from: toLocalDateString(start) } : {};
}

export function rangeLabelFor(range: AnalyticsRangeKey): string {
  return ANALYTICS_RANGE_OPTIONS.find((r) => r.key === range)?.label || "All time";
}
