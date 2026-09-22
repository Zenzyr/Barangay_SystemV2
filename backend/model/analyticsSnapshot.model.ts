import mongoose, { Schema } from 'mongoose';

/**
 * AnalyticsSnapshot — a persisted, aggregate-only AnalyticsSummary captured at
 * Decision Support generation time.
 *
 * Privacy contract: the snapshot stores exactly the output of
 * AnalyticsService.getSummary() (counts / rates / labels). It never stores
 * resident or account PII (names, emails, phones, addresses, account ids).
 *
 * Retention: snapshots are never auto-deleted. They are an immutable history
 * of the numbers every Decision Support analysis was based on.
 */
const AnalyticsSnapshotSchema = new Schema({
  // The full normalized analytics payload this snapshot captured.
  data: { type: Schema.Types.Mixed, required: true },
  // Schema version of the snapshot payload, for forward-compatible reads.
  analyticsVersion: { type: Number, default: 1 },
  // Who generated this snapshot (mirrors the Decision Support actor).
  generatedBy: { type: String, required: true, default: 'System' },
  generatedById: { type: String, default: '' },
}, { timestamps: true });

// Latest-snapshot lookups (the page loads the most recent one on open).
AnalyticsSnapshotSchema.index({ createdAt: -1 });

export default mongoose.model('AnalyticsSnapshot', AnalyticsSnapshotSchema);