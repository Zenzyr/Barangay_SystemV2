import AnalyticsSnapshotModel from "../model/analyticsSnapshot.model";
import { AnalyticsSummary } from "../types/analytics.type";

/**
 * AnalyticsSnapshotService — persistence and read-only retrieval of the
 * aggregate-only analytics snapshots captured during Decision Support
 * generation.
 *
 * Creation only ever happens through create(), which is called exclusively
 * from DecisionSupportService.generate() — never from a GET / any read.
 */
export class AnalyticsSnapshotService {

  /**
   * Persist an analytics snapshot. Called with the exact AnalyticsSummary
   * that a Decision Support generation is about to analyze, so the snapshot
   * survives even if the AI provider call afterwards fails.
   */
  static async create(data: AnalyticsSummary, generatedBy = "System", generatedById = "") {
    return await AnalyticsSnapshotModel.create({
      data,
      generatedBy: generatedBy || "System",
      generatedById: generatedById || "",
    });
  }

  /** The most recently captured snapshot (returns null when none exists). */
  static async getLatest() {
    return await AnalyticsSnapshotModel.findOne().sort({ createdAt: -1 });
  }

  static async getHistory(limit?: number) {
    const query = AnalyticsSnapshotModel.find().sort({ createdAt: -1 });
    if (limit && Number.isFinite(limit) && limit > 0) {
      query.limit(Math.min(Math.floor(limit), 100));
    }
    return await query;
  }

  static async get(id: string) {
    return await AnalyticsSnapshotModel.findById(id);
  }
}