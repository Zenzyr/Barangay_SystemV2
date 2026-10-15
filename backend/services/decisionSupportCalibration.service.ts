import { AnalyticsService } from "./analyticsService";
import { AnalyticsSummary } from "../types/analytics.type";
import { TRACKED_METRICS, classifyOutcome } from "../utils/analyticsMetrics";
import { CalibrationResult, CalibrationRow, MetricOutcome } from "../types/recommendationFeedback.type";

/**
 * Outcome calibration.
 *
 * Compares the indicators captured in a saved Decision Support analysis
 * (its frozen `dataSnapshot`) against the SAME indicators recomputed from live
 * analytics right now. This turns a one-shot recommendation into a trackable
 * outcome: did the backlog actually shrink? Did the verification queue clear?
 *
 * Read-only and deterministic — it never mutates the saved analysis.
 */
export class DecisionSupportCalibrationService {

  /** Build the calibration report for one saved analysis snapshot. */
  static async compare(snapshot: AnalyticsSummary): Promise<CalibrationResult> {
    const current = await AnalyticsService.getSummary();
    const period = current.period;

    const rows: CalibrationRow[] = [];
    for (const def of TRACKED_METRICS) {
      const baseline = safeRead(def.read, snapshot);
      // Skip indicators the analysis never captured, so we never claim to have
      // measured something the snapshot did not contain.
      if (baseline === null) continue;

      const now = safeRead(def.read, current);
      const delta = now === null ? null : Math.round((now - baseline) * 100) / 100;
      rows.push({
        key: def.key,
        label: def.label,
        baseline,
        current: now,
        delta,
        outcome: classifyOutcome(def, baseline, now),
      });
    }

    const summary: Record<MetricOutcome, number> = {
      resolved: 0,
      improved: 0,
      unchanged: 0,
      worsened: 0,
      unknown: 0,
    };
    for (const row of rows) summary[row.outcome]++;

    return { period, rows, summary };
  }
}

function safeRead(read: (s: AnalyticsSummary) => number | null, summary: AnalyticsSummary): number | null {
  try {
    return read(summary);
  } catch {
    return null;
  }
}
