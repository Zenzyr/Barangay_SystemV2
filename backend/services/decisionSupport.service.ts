import { AnalyticsService } from "./analyticsService";
import { AIInsightService } from "./ai/aiInsightService";
import { AnalyticsSnapshotService } from "./analyticsSnapshot.service";
import { InsightItem, RecommendationItem } from "../types/ai.type";
import DecisionSupportAnalysisModel from "../model/decisionSupportAnalysis.model";

/**
 * Persisted Decision Support analyses.
 *
 * Generation only ever happens through DecisionSupportService.generate() —
 * it is never triggered by a GET / any read. Reads (latest / history / get)
 * simply load saved records.
 */
export class DecisionSupportService {

  /**
   * Snapshot the current analytics, run the existing AI/rule-based insight
   * pipeline, and persist a new analysis record.
   *
   * Order: 1) AnalyticsService.getSummary() 2) persist an AnalyticsSnapshot
   * (so the captured numbers survive even if the AI call fails) 3) run the
   * AI/rule-based pipeline 4) persist the DecisionSupportAnalysis record
   * linked to the snapshot via analyticsSnapshotId.
   *
   * The DecisionSupportAnalysis record is never saved unless generation
   * succeeds, so a failed generation can never overwrite or remove a previous
   * successful analysis. A snapshot may remain from a failed generation — that
   * is intentional: it records the numbers that a generation attempt saw.
   */
  static async generate(generatedBy: string, generatedById?: string) {
    const actor = { name: generatedBy || "System", id: generatedById || "" };

    // The exact analytics payload used for this generation, captured first as
    // a durable, aggregate-only snapshot.
    const data = await AnalyticsService.getSummary();
    const snapshot = await AnalyticsSnapshotService.create(data, actor.name, actor.id);
    const snapshotId = snapshot._id?.toString?.() || null;

    const result = await AIInsightService.generateInsights(data);

    const insights = Array.isArray(result.insights) ? result.insights : [];
    const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];

    const record = await DecisionSupportAnalysisModel.create({
      generatedAt: new Date(),
      generatedBy: actor.name,
      generatedById: actor.id,
      analyticsSnapshotId: snapshotId,
      dataSnapshot: data,
      insights,
      recommendations,
      confidence: result.confidence ?? null,
      provider: result.provider,
      providerLabel: result.providerLabel,
      connected: result.connected,
      summary: summaryOf(insights, recommendations),
    });

    return { record, snapshotId };
  }

  /** The most recently generated analysis (returns null when none exists). */
  static async getLatest() {
    return await DecisionSupportAnalysisModel.findOne().sort({ generatedAt: -1 });
  }

  static async getHistory(limit?: number) {
    const query = DecisionSupportAnalysisModel.find().sort({ generatedAt: -1 });
    if (limit && Number.isFinite(limit) && limit > 0) {
      query.limit(Math.min(Math.floor(limit), 100));
    }
    return await query;
  }

  static async get(id: string) {
    return await DecisionSupportAnalysisModel.findById(id);
  }
}

function summaryOf(insights: InsightItem[], recommendations: RecommendationItem[]): string {
  const headline = recommendations[0]?.title ?? insights[0]?.title;
  if (headline) return headline;
  return insights.length === 0 && recommendations.length === 0
    ? "No issues detected."
    : `Generated ${insights.length} insight(s) and ${recommendations.length} recommendation(s).`;
}