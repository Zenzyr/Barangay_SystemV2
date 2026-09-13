/**
 * Frontend types for the unified Analytics Data Service and the
 * AIInsightService output consumed by the Decision Support page.
 */

export interface AnalyticsPeriod {
  from: string | null;
  to: string | null;
  label: string;
}

export type InsightSeverity = "warning" | "info" | "positive";

export interface InsightItem {
  id: string;
  category: string;
  title: string;
  why: string;
  action: string;
  severity: InsightSeverity;
}

export interface RecommendationItem {
  id: string;
  category: string;
  title: string;
  why: string;
  action: string;
  severity: InsightSeverity;
}

export interface AnalyticsInsightsResponse {
  provider: string;
  providerLabel: string;
  connected: boolean;
  insights: InsightItem[];
  recommendations: RecommendationItem[];
  confidence: number | null;
  period?: AnalyticsPeriod;
}