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

/**
 * A persisted Decision Support analysis. Every successful generation creates
 * one record; the page loads the latest record and only generates a new one
 * when the user clicks "Generate New Analysis".
 */
export interface DecisionSupportAnalysis {
  _id: string;
  generatedAt: string;
  generatedBy: string;
  generatedById?: string;
  /** The analytics snapshot that was analyzed when this was generated. */
  dataSnapshot: {
    period?: AnalyticsPeriod;
    overview?: {
      totalRequests: number;
      completedRequests: number;
      completionRate: number;
      revenueCollected: number;
      pendingRevenue: number;
      unpaidCount: number;
      backlogCount: number;
      weekOverWeekChange: number;
      totalUsers: number;
      activeUsers: number;
      pendingUsers: number;
      rejectedUsers: number;
      growthRate: number;
      topDocument: { name: string; count: number; pct: number } | null;
      peakDay: { name: string; count: number } | null;
    };
    community?: {
      totalResidents: number;
      totalHouseholds: number;
      children: number;
      youth: number;
      sectorRates?: Record<string, number | undefined>;
      sectorCounts?: Record<string, number | undefined>;
      serviceSignals?: {
        totalRegisteredResidents: number;
        indigencyRequests: number;
        indigencyRequestRate: number;
      };
      topIssues?: {
        category: string;
        problem: string;
        rate: number;
        affectedCount: number;
        severity: string;
        priorityScore: number;
        recommendedProgram: string;
      }[];
    };
  };
  insights: InsightItem[];
  recommendations: RecommendationItem[];
  confidence: number | null;
  provider: string;
  providerLabel: string;
  connected: boolean;
  summary: string;
  createdAt: string;
  updatedAt: string;
}