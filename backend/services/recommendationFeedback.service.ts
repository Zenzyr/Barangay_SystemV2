import RecommendationFeedbackModel from "../model/recommendationFeedback.model";
import {
  RecommendationFeedbackInput,
  RecommendationFeedbackStatus,
} from "../types/recommendationFeedback.type";

interface Actor {
  name: string;
  id: string;
}

/**
 * RecommendationFeedbackService — persistence and reads for the staff feedback
 * attached to saved Decision Support recommendations.
 *
 * Upsert-only: saving feedback for the same (analysisId, recommendationId)
 * updates the existing row, so a recommendation can never accumulate duplicate
 * responses.
 */
export class RecommendationFeedbackService {

  /**
   * Create or update the feedback for one recommendation of one analysis.
   * Optionally denormalizes the recommendation category/title for display.
   */
  static async upsert(
    analysisId: string,
    input: RecommendationFeedbackInput,
    actor: Actor,
    label?: { category?: string; title?: string },
  ) {
    const update: Record<string, unknown> = {
      status: input.status,
      note: input.note ?? "",
      updatedBy: actor.name,
      updatedById: actor.id,
    };
    if (label?.category !== undefined) update.category = label.category;
    if (label?.title !== undefined) update.title = label.title;

    return await RecommendationFeedbackModel.findOneAndUpdate(
      { analysisId, recommendationId: input.recommendationId },
      {
        $set: update,
        $setOnInsert: {
          analysisId,
          recommendationId: input.recommendationId,
          createdBy: actor.name,
          createdById: actor.id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  /** All feedback rows for one analysis (newest update first). */
  static async listByAnalysis(analysisId: string) {
    return await RecommendationFeedbackModel.find({ analysisId }).sort({ updatedAt: -1 });
  }

  /** Counts of feedback by status across every analysis (calibration signal). */
  static async statusSummary(): Promise<Record<RecommendationFeedbackStatus, number>> {
    const rows = await RecommendationFeedbackModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const summary: Record<RecommendationFeedbackStatus, number> = {
      acknowledged: 0,
      applied: 0,
      dismissed: 0,
      resolved: 0,
    };
    for (const row of rows) {
      if (row._id in summary) summary[row._id as RecommendationFeedbackStatus] = row.count;
    }
    return summary;
  }
}
