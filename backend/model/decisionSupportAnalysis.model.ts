import mongoose, { Schema } from 'mongoose';

const DecisionSupportAnalysisSchema = new Schema({
  generatedAt: { type: Date, required: true, default: () => new Date() },
  generatedBy: { type: String, required: true },
  generatedById: { type: String, default: '' },
  // Reference to the AnalyticsSnapshot this analysis was based on. Null for
  // records generated before the snapshot feature shipped (legacy records).
  analyticsSnapshotId: { type: String, default: null },
  // Exact analytics payload analyzed at generation time, so an old result
  // keeps showing the numbers it was based on.
  dataSnapshot: { type: Schema.Types.Mixed, required: true },
  insights: { type: [Schema.Types.Mixed], default: [] },
  recommendations: { type: [Schema.Types.Mixed], default: [] },
  confidence: { type: Schema.Types.Mixed, default: null },
  provider: { type: String, default: 'rule-based' },
  providerLabel: { type: String, default: '' },
  connected: { type: Boolean, default: false },
  summary: { type: String, default: '' },
}, { timestamps: true });

// Latest-analysis lookups (the page loads the most recent record on open).
DecisionSupportAnalysisSchema.index({ generatedAt: -1 });

export default mongoose.model('DecisionSupportAnalysis', DecisionSupportAnalysisSchema);