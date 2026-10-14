/**
 * Compares the live non-archived resident count (the Resident Census source)
 * against the value frozen inside the latest saved Decision Support analysis
 * snapshot. Dependency-free so it can be unit tested directly.
 */

export type ResidentCountStatus = "match" | "mismatch" | "unknown";

/** Exact copy required by the Decision Support dashboard. */
export const RESIDENT_COUNT_MISMATCH_MESSAGE =
  "Resident census data has changed since this analysis was generated. Regenerate the analysis to update the figures.";

/** Shown when the saved snapshot still agrees with the live census. */
export const RESIDENT_COUNT_MATCH_MESSAGE = "Resident count is up to date";

/**
 * "match"    → both counts are known and equal
 * "mismatch" → both counts are known and differ
 * "unknown"  → one/both counts are missing or not finite (cannot compare)
 */
export function residentCountStatus(
  liveCount: number | null | undefined,
  snapshotTotal: number | null | undefined,
): ResidentCountStatus {
  const live =
    typeof liveCount === "number" && Number.isFinite(liveCount)
      ? liveCount
      : null;
  const snapshot =
    typeof snapshotTotal === "number" && Number.isFinite(snapshotTotal)
      ? snapshotTotal
      : null;

  if (live === null || snapshot === null) return "unknown";
  return live === snapshot ? "match" : "mismatch";
}
