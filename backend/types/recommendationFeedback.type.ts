/**
 * Recommendation feedback — the human-in-the-loop signal attached to a saved
 * Decision Support recommendation. Staff record what they did about a
 * recommendation so the system can later calibrate which rules are useful.
 */

export const FEEDBACK_STATUSES = [
  "acknowledged",
  "applied",
  "dismissed",
  "resolved",
] as const;

export type RecommendationFeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Max length of a feedback note — shared by the controller check and the model. */
export const MAX_FEEDBACK_NOTE_LENGTH = 1000;

export interface RecommendationFeedbackInput {
  recommendationId: string;
  status: RecommendationFeedbackStatus;
  note?: string;
}

export interface RecommendationFeedback extends RecommendationFeedbackInput {
  _id: string;
  analysisId: string;
  category?: string;
  title?: string;
  createdBy: string;
  createdById: string;
  updatedBy: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
}

// ── Outcome calibration ──────────────────────────────────────────

export type MetricOutcome =
  | "resolved"
  | "improved"
  | "unchanged"
  | "worsened"
  | "unknown";

export interface CalibrationRow {
  key: string;
  label: string;
  baseline: number | null; // value captured in the saved analysis snapshot
  current: number | null; // value recomputed from live analytics
  delta: number | null; // current - baseline
  outcome: MetricOutcome;
}

export interface CalibrationResult {
  period: { from: string | null; to: string | null; label: string };
  rows: CalibrationRow[];
  summary: Record<MetricOutcome, number>;
}
