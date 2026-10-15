import { AnalyticsSummary } from "../types/analytics.type";
import { MetricOutcome } from "../types/recommendationFeedback.type";

/**
 * Metric registry for outcome calibration.
 *
 * Each tracked indicator knows how to read its value out of an AnalyticsSummary
 * and which direction is "bad". A saved snapshot's value (baseline) is compared
 * against the freshly-computed value (current) to classify whether matters have
 * improved, stayed the same, or worsened since the analysis was generated.
 *
 * Only indicators that actually drive recommendations are tracked; adding one
 * here is the single place needed to extend calibration coverage.
 */

export type BadDirection = "higherIsWorse" | "lowerIsWorse";

export interface MetricDefinition {
  key: string;
  label: string;
  badDirection: BadDirection;
  read: (s: AnalyticsSummary) => number | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const TRACKED_METRICS: readonly MetricDefinition[] = [
  // ── Operational (overview) ──
  { key: "backlogCount", label: "Backlogged requests (>3 days)", badDirection: "higherIsWorse", read: (s) => num(s.overview?.backlogCount) },
  { key: "oldestPendingAgeDays", label: "Oldest pending request (days)", badDirection: "higherIsWorse", read: (s) => num(s.overview?.oldestPendingAgeDays) },
  { key: "unpaidCount", label: "Unpaid active requests", badDirection: "higherIsWorse", read: (s) => num(s.overview?.unpaidCount) },
  { key: "pendingVerificationCount", label: "Payments awaiting verification", badDirection: "higherIsWorse", read: (s) => num(s.overview?.pendingVerificationCount) },
  { key: "rejectedPaymentCount", label: "Rejected payments", badDirection: "higherIsWorse", read: (s) => num(s.overview?.rejectedPaymentCount) },
  { key: "counterPaymentCount", label: "Counter-payments pending", badDirection: "higherIsWorse", read: (s) => num(s.overview?.counterPaymentCount) },
  { key: "blockedFromRelease", label: "Ready but blocked from release", badDirection: "higherIsWorse", read: (s) => num(s.overview?.blockedFromRelease) },
  { key: "pendingUsers", label: "Residents awaiting ID verification", badDirection: "higherIsWorse", read: (s) => num(s.overview?.pendingUsers) },
  { key: "completionRate", label: "Request completion rate (%)", badDirection: "lowerIsWorse", read: (s) => num(s.overview?.completionRate) },

  // ── Community sector rates (percent of population) ──
  { key: "unemploymentRateHeuristic", label: "Unemployment rate (heuristic, %)", badDirection: "higherIsWorse", read: (s) => num(s.community?.sectorRates?.unemploymentRateHeuristic) },
  { key: "outOfSchoolRateHeuristic", label: "Out-of-school rate (heuristic, %)", badDirection: "higherIsWorse", read: (s) => num(s.community?.sectorRates?.outOfSchoolRateHeuristic) },
  { key: "seniorCitizenRate", label: "Senior citizen share (%)", badDirection: "higherIsWorse", read: (s) => num(s.community?.sectorRates?.seniorCitizenRate) },
  { key: "pwdRate", label: "PWD share (%)", badDirection: "higherIsWorse", read: (s) => num(s.community?.sectorRates?.pwdRate) },
  { key: "youthRate", label: "Youth share (%)", badDirection: "higherIsWorse", read: (s) => num(s.community?.sectorRates?.youthRate) },
];

/**
 * Classifies the change between a baseline and its current value.
 *
 * A change counts as real only when it exceeds a small tolerance (max of 1
 * unit or 5% of the baseline) so noise doesn't register as movement. A
 * higherIsWorse metric that reaches zero is "resolved" rather than merely
 * "improved".
 */
export function classifyOutcome(
  def: Pick<MetricDefinition, "badDirection">,
  baseline: number | null,
  current: number | null,
): MetricOutcome {
  if (baseline === null || current === null) return "unknown";

  // A higher-is-worse indicator that has reached zero is fully resolved, even
  // when the move is small enough to sit inside the normal noise tolerance.
  if (def.badDirection === "higherIsWorse" && baseline > 0 && current <= 0) {
    return "resolved";
  }

  const delta = current - baseline;
  const tolerance = Math.max(1, Math.abs(baseline) * 0.05);
  // Strictly inside the band = noise. A move of exactly the tolerance counts
  // as a real change (and is covered by the boundary tests).
  if (Math.abs(delta) < tolerance) return "unchanged";

  const gotBetter = def.badDirection === "higherIsWorse" ? delta < 0 : delta > 0;
  return gotBetter ? "improved" : "worsened";
}
