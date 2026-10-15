import mongoose, { Schema } from 'mongoose';
import {
  FEEDBACK_STATUSES,
  MAX_FEEDBACK_NOTE_LENGTH,
} from '../types/recommendationFeedback.type';

/**
 * RecommendationFeedback — one staff response per saved recommendation.
 *
 * A saved Decision Support analysis is immutable, but the human follow-up on
 * its recommendations is mutable. Feedback is keyed by
 * (analysisId, recommendationId) so a re-save updates the existing response
 * instead of stacking duplicates. No resident PII is stored — only the
 * aggregate recommendation label and the staff actor.
 */
const RecommendationFeedbackSchema = new Schema({
  analysisId: { type: Schema.Types.ObjectId, ref: 'DecisionSupportAnalysis', required: true },
  recommendationId: { type: String, required: true },
  // Denormalized for display without re-loading the analysis.
  category: { type: String, default: '' },
  title: { type: String, default: '' },
  status: { type: String, required: true, enum: FEEDBACK_STATUSES as unknown as string[] },
  note: { type: String, default: '', maxlength: MAX_FEEDBACK_NOTE_LENGTH },
  createdBy: { type: String, default: '' },
  createdById: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
  updatedById: { type: String, default: '' },
}, { timestamps: true });

// One feedback row per recommendation per analysis.
RecommendationFeedbackSchema.index({ analysisId: 1, recommendationId: 1 }, { unique: true });
// Aggregate calibration reads group feedback across analyses.
RecommendationFeedbackSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model('RecommendationFeedback', RecommendationFeedbackSchema);
