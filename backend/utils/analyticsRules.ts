// Centralized analytics scoring rules.
//
// This is the ONLY place severity bands and priority-score weights are defined.
// Every service that classifies a rate or scores a recommendation must import
// from here rather than re-declaring thresholds locally.

export type Severity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

// Default severity bands for a percentage-style indicator (0-100).
// Matches the banding requested in the spec: 0-5 LOW, 5-10 MODERATE, 10-20 HIGH, >20 CRITICAL.
const SEVERITY_BANDS: { max: number; level: Severity }[] = [
  { max: 5, level: "LOW" },
  { max: 10, level: "MODERATE" },
  { max: 20, level: "HIGH" },
  { max: Infinity, level: "CRITICAL" },
];

export function getSeverity(ratePercent: number): Severity {
  for (const band of SEVERITY_BANDS) {
    if (ratePercent <= band.max) return band.level;
  }
  return "CRITICAL";
}

// Base score per severity level, plus small transparent bonuses for how far
// above the band the rate sits and how many people are affected. Capped at 100.
const BASE_SCORE: Record<Severity, number> = {
  LOW: 25,
  MODERATE: 50,
  HIGH: 75,
  CRITICAL: 90,
};

export function getPriorityScore(ratePercent: number, severity: Severity, affectedCount: number): number {
  const base = BASE_SCORE[severity];
  const rateBonus = Math.min(10, Math.round(ratePercent / 10));
  const countBonus = affectedCount > 50 ? 5 : affectedCount > 20 ? 3 : affectedCount > 0 ? 1 : 0;
  return Math.min(100, base + rateBonus + countBonus);
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
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // 2 decimal places
}
