/**
 * Normalized analytics summary — the single source of truth for the Unified
 * Analytics page, the Decision Support page, and every AI insight provider.
 *
 * Produced ONLY by AnalyticsService.getSummary(). Consumers (UI, AI layer)
 * must read from this payload rather than querying the database directly, so
 * analytics and AI can never see different numbers.
 */

export interface AnalyticsPeriod {
  from: string | null; // ISO date (YYYY-MM-DD) or null for "all time"
  to: string | null;
  label: string; // human-readable description of the window
}

/** Live counts grouped by the primary request lifecycle statuses. */
export interface RequestStatusCounts {
  pending: number;
  processing: number;
  ready: number;
  released: number;
  cancelled: number;
  rejected: number;
  toClaim: number; // legacy status kept for backward compatibility
  completed: number; // legacy terminal status kept for backward compatibility
}

export interface AnalyticsOverview {
  // Document requests (barangay certificates / clearances / etc.)
  totalRequests: number;
  completedRequests: number;
  completionRate: number; // 0-100
  statusCounts: RequestStatusCounts;
  pendingRequests: number;
  processingRequests: number;
  readyRequests: number;
  rejectedRequests: number;
  cancelledRequests: number;
  revenueCollected: number; // pesos (from stored request price)
  pendingRevenue: number; // pesos outstanding on active requests
  unpaidCount: number;
  backlogCount: number; // pending/processing requests older than 3 days
  overdueRequests: number; // same family as backlogCount (currently identical)
  oldestPendingAgeDays: number | null; // age of the oldest backlogged request
  averageProcessingTimeDays: number | null; // created → released/completed (status history)
  processingTimeAvailable: boolean; // false when no terminal status history exists yet
  weekOverWeekChange: number; // % request volume this week vs last week

  // Payments & revenue
  pendingVerificationCount: number; // paymentVerificationStatus === "pending"
  rejectedPaymentCount: number; // paymentVerificationStatus === "rejected"
  counterPaymentCount: number; // residents asked to pay at the hall, not yet paid
  blockedFromRelease: number; // request is "ready" but payment is not confirmed

  // Accounts / residents
  totalUsers: number;
  activeUsers: number; // approved accounts
  pendingUsers: number; // awaiting ID verification
  rejectedUsers: number;
  growthRate: number; // % new registrations in the window vs the previous window

  // Highlights
  topDocument: { name: string; count: number; pct: number } | null;
  peakDay: { name: string; count: number } | null;
  peakHour: { name: string; count: number } | null;
}

export interface CommunitySectorRates {
  unemploymentRateHeuristic: number;
  outOfSchoolRateHeuristic: number;
  seniorCitizenRate: number;
  pwdRate: number;
  youthRate: number;
  fourPsRate: number;
  soloParentRate: number;
  hpnMaintenanceRate: number;
  familyPlanningRate: number;
}

export interface CommunitySectorCounts {
  workingAgePopulation: number;
  unemployedHeuristic: number;
  schoolAgePopulation: number;
  outOfSchoolHeuristic: number;
  seniorCitizens: number;
  pwd: number;
}

export interface CommunityTopIssue {
  category: string;
  problem: string;
  rate: number;
  affectedCount: number;
  severity: string; // LOW | MODERATE | HIGH | CRITICAL
  priorityScore: number; // 0-100
  recommendedProgram: string;
}

export interface CommunityServiceSignals {
  totalRegisteredResidents: number;
  indigencyRequests: number;
  indigencyRequestRate: number;
}

export interface AnalyticsCommunity {
  totalResidents: number;
  totalHouseholds: number;
  children: number;
  youth: number;
  sectorCounts: CommunitySectorCounts;
  sectorRates: CommunitySectorRates;
  topIssues: CommunityTopIssue[];
  serviceSignals: CommunityServiceSignals;
}

export interface TrendPoint {
  label: string;
  count: number;
}

export interface AnalyticsTrends {
  userGrowth: TrendPoint[]; // resident registrations per week
  engagementOverTime: TrendPoint[]; // document requests per day
}

/**
 * Indicators the system KNOWS it cannot compute from the current database
 * schema. Listed explicitly so the UI and the AI providers never present a
 * placeholder as a real number.
 */
export interface AnalyticsLimitations {
  secretaryAvailability: string; // not tracked anywhere in the schema
  requirementDelays: string; // no field records "held up for missing requirements"
  recurringTrend: string; // recurrence needs prior snapshots to compare
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  overview: AnalyticsOverview;
  community: AnalyticsCommunity;
  trends: AnalyticsTrends;
  limitations: AnalyticsLimitations;
  scoringVersion: string; // which analyticsRules weights produced this summary
}

export interface AnalyticsSummaryQuery {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}