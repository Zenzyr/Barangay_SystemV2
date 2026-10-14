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

/** Optional, provider-agnostic metadata on an insight/recommendation. */
export interface InsightMeta {
  /** The raw numbers from the analytics payload that support this item. */
  evidence?: string[];
  /** Staff role that should own the follow-up, when identifiable. */
  responsibleRole?: string;
  /** What success looks like once the action is taken. */
  expectedOutcome?: string;
  /** Suggested timeframe, e.g. "This week", "Within 3 days". */
  timeframe?: string;
  /** Deterministic priority score (0-100). */
  priorityScore?: number;
}

export interface InsightItem extends InsightMeta {
  id: string;
  category: string;
  title: string;
  why: string;
  action: string;
  severity: InsightSeverity;
}

export interface RecommendationItem extends InsightMeta {
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
  notice?: string;
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
      statusCounts?: {
        pending: number;
        processing: number;
        ready: number;
        released: number;
        cancelled: number;
        rejected: number;
        toClaim: number;
        completed: number;
      };
      pendingRequests?: number;
      processingRequests?: number;
      readyRequests?: number;
      rejectedRequests?: number;
      cancelledRequests?: number;
      revenueCollected: number;
      pendingRevenue: number;
      unpaidCount: number;
      backlogCount: number;
      overdueRequests?: number;
      oldestPendingAgeDays?: number | null;
      averageProcessingTimeDays?: number | null;
      processingTimeAvailable?: boolean;
      weekOverWeekChange: number;
      pendingVerificationCount?: number;
      rejectedPaymentCount?: number;
      counterPaymentCount?: number;
      blockedFromRelease?: number;
      totalUsers: number;
      activeUsers: number;
      pendingUsers: number;
      rejectedUsers: number;
      growthRate: number;
      topDocument: { name: string; count: number; pct: number } | null;
      peakDay: { name: string; count: number } | null;
      peakHour?: { name: string; count: number } | null;
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
    limitations?: {
      secretaryAvailability?: string;
      requirementDelays?: string;
      recurringTrend?: string;
    };
  };
  insights: InsightItem[];
  recommendations: RecommendationItem[];
  confidence: number | null;
  provider: string;
  providerLabel: string;
  connected: boolean;
  notice?: string;
  scoringVersion?: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}