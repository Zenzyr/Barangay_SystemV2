// Centralized analytics scoring rules.
//
// This is the ONLY place severity bands, priority-score weights, and the
// scoring-version string are defined. Every service that classifies a rate or
// scores a recommendation must import from here rather than re-declaring
// thresholds locally. Priority is therefore fully deterministic — an AI
// provider can never change a score on its own.

export type Severity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

// Bumping this string marks the exact weights that produced a given analysis,
// so a future weight change cannot silently invalidate historical scores.
export const SCORING_VERSION = "v2";

// Severity bands (0-100 percentage-style indicators).
//
// Boundary rule: upper bounds are INCLUSIVE here, so every rate maps to exactly
// one band (5 → LOW, 10 → MODERATE, 20 → HIGH, anything above 20 → CRITICAL).
// This matches the original spec ("0–5 LOW, 5–10 MODERATE, 10–20 HIGH, above
// 20 CRITICAL") and keeps historical behavior — no score can belong to two
// categories. Non-finite, negative and zero rates are treated as LOW.
export const SEVERITY_BANDS: readonly { level: Severity; min: number; max: number }[] = [
  { level: "LOW", min: 0, max: 5 },
  { level: "MODERATE", min: 5, max: 10 },
  { level: "HIGH", min: 10, max: 20 },
  { level: "CRITICAL", min: 20, max: Infinity },
];

export function getSeverity(ratePercent: number): Severity {
  const rate = Number.isFinite(ratePercent) ? Math.max(0, ratePercent) : 0;
  for (const band of SEVERITY_BANDS) {
    if (rate <= band.max) return band.level;
  }
  return "CRITICAL";
}

// Unweighted category weights used to rank LOW→CRITICAL issues. Kept separate
// from the 0-100 priority score so the UI can render a category label.
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

// Base score per severity level. Transparent, fixed weights — see the
// priority formula below for how the remaining 0-… points are earned.
const BASE_SCORE: Record<Severity, number> = {
  LOW: 20,
  MODERATE: 40,
  HIGH: 60,
  CRITICAL: 80,
};

// Deterministic, additive bonuses. Each factor is capped so a single metric can
// never dominate the score. Total is clamped to 0-100.
const WEIGHTS = {
  // How far a rate sits above its band, pointing to the worst cases (cap 12).
  rateBonusCap: 12,
  rateBonusPerPoint: 8, // 1 point per ~8 percentage points of the rate
  // Number of residents / requests impacted (cap 8).
  countBonusHigh: 8, // > 50
  countBonusMedium: 5, // > 20
  countBonusLow: 2, // > 0
  // Age of the backlog / processing delay in days (1 pt per 3 days, cap 10).
  ageBonusCap: 10,
  ageBonusPerDays: 3,
  // Request is blocking document release or an essential service (cap 8).
  releaseBonus: 8,
  // Payment / verification delay is the underlying cause (cap 6).
  paymentBonus: 6,
  // The same issue was present in the previous period — recurring (cap 5).
  recurringBonus: 5,
  // The metric is actively worsening vs the previous period (cap 5).
  worseningBonus: 5,
};

export interface PriorityFactors {
  ageDays?: number; // backlog / delay age in days
  blocksRelease?: boolean; // blocks document release or an essential service
  paymentDelay?: boolean; // payment or verification delay is the cause
  recurring?: boolean; // also present in the previous period
  worsening?: boolean; // worse than the previous period
}

/**
 * Priority score for a rate-based indicator (community sectors, thresholds).
 * Deterministic: base(severity) + capped bonuses for how bad the rate is, how
 * many people are hit, and any additional factors. Bounded between 0 and 100.
 */
export function getPriorityScore(
  ratePercent: number,
  severity: Severity,
  affectedCount: number,
  factors: PriorityFactors = {},
): number {
  const base = BASE_SCORE[severity] ?? BASE_SCORE.LOW;
  const rateBonus = Math.min(
    WEIGHTS.rateBonusCap,
    Math.round((Number.isFinite(ratePercent) ? Math.max(0, ratePercent) : 0) / WEIGHTS.rateBonusPerPoint),
  );
  const countBonus =
    affectedCount > 50
      ? WEIGHTS.countBonusHigh
      : affectedCount > 20
        ? WEIGHTS.countBonusMedium
        : affectedCount > 0
          ? WEIGHTS.countBonusLow
          : 0;
  const ageBonus = Math.min(
    WEIGHTS.ageBonusCap,
    Math.max(
      0,
      Math.round(
        (Number.isFinite(factors.ageDays ?? 0) ? (factors.ageDays ?? 0) : 0) /
          WEIGHTS.ageBonusPerDays,
      ),
    ),
  );

  return clamp(
    base +
      rateBonus +
      countBonus +
      ageBonus +
      (factors.blocksRelease ? WEIGHTS.releaseBonus : 0) +
      (factors.paymentDelay ? WEIGHTS.paymentBonus : 0) +
      (factors.recurring ? WEIGHTS.recurringBonus : 0) +
      (factors.worsening ? WEIGHTS.worseningBonus : 0),
  );
}

/**
 * Priority score for operational issues that are not naturally expressed as a
 * percentage rate (backlogs, payment queues, blocked releases). The caller
 * supplies the operational category; the category maps onto the fixed severity
 * bands so scoring stays under the same authority as rate-based indicators.
 */
export function priorityScoreOf(
  operational: "warning" | "info" | "positive",
  affectedCount: number,
  factors: PriorityFactors = {},
): number {
  const severity: Severity =
    operational === "warning" ? "HIGH" : operational === "info" ? "MODERATE" : "LOW";
  return getPriorityScore(0, severity, affectedCount, factors);
}

export function evaluateOperator(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case ">": return value > threshold;
    case ">=": return value >= threshold;
    case "<": return value < threshold;
    case "<=": return value <= threshold;
    case "==": return value === threshold;
    default: return false;
  }
}

export function safeRate(numerator: number, denominator: number): number {
  if (!denominator || !Number.isFinite(numerator) || numerator < 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // 2 decimal places
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
