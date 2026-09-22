/**
 * A persisted AnalyticsSnapshot.
 *
 * One snapshot is created for every explicit Decision Support generation and
 * referenced from the DecisionSupportAnalysis record via `analyticsSnapshotId`.
 * Reads of snapshots never create or modify anything.
 */

import { AnalyticsSummary } from "./analytics.type";

export interface AnalyticsSnapshot {
  _id: string;
  /** The aggregate-only analytics payload captured at generation time. */
  data: AnalyticsSummary;
  /** Schema version of the stored payload (currently 1). */
  analyticsVersion: number;
  /** Display name of the secretary / admin who triggered the generation. */
  generatedBy: string;
  generatedById?: string;
  createdAt: string;
  updatedAt: string;
}