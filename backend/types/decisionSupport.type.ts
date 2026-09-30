/**
 * A saved Decision Support analysis.
 *
 * Every successful generation is persisted as a single record so the page
 * can show the *latest* analysis on load, keep older ones in history, and
 * never regenerate anything unless the user explicitly clicks
 * "Generate New Analysis".
 *
 * `dataSnapshot` holds the exact analytics payload that was analyzed at
 * generation time (the output of AnalyticsService.getSummary()), so an old
 * recommendation always shows the data it was based on even after the live
 * census numbers change.
 */

import { AnalyticsSummary } from "./analytics.type";
import { AIProviderInfo, InsightItem, RecommendationItem } from "./ai.type";

export interface DecisionSupportAnalysis {
  _id: string;
  /** When the analysis was generated (explicit user action, not page load). */
  generatedAt: Date;
  /** Display name of the secretary / admin who generated it. */
  generatedBy: string;
  generatedById?: string;
  /** Id of the persisted AnalyticsSnapshot this analysis is based on
   *  (null for analyses generated before snapshots existed). */
  analyticsSnapshotId?: string | null;
  /** The analytics snapshot that was analyzed for this generation. */
  dataSnapshot: AnalyticsSummary;
  insights: InsightItem[];
  recommendations: RecommendationItem[];
  confidence: number | null;
  provider: AIProviderInfo["provider"];
  providerLabel: string;
  connected: boolean;
  /** Short human-readable headline used in history listings. */
  summary: string;
  createdAt: string;
  updatedAt: string;
}