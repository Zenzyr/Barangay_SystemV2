import type {
  AnalyticsCommunity,
  AnalyticsLimitations,
  AnalyticsOverview,
  AnalyticsSummary,
} from "../../types/analytics.type";

const emptyRates = {
  unemploymentRateHeuristic: 0,
  outOfSchoolRateHeuristic: 0,
  seniorCitizenRate: 0,
  pwdRate: 0,
  youthRate: 0,
  fourPsRate: 0,
  soloParentRate: 0,
  hpnMaintenanceRate: 0,
  familyPlanningRate: 0,
};

const emptyCommunity: AnalyticsCommunity = {
  totalResidents: 0,
  totalHouseholds: 0,
  children: 0,
  youth: 0,
  sectorCounts: {
    workingAgePopulation: 0,
    unemployedHeuristic: 0,
    schoolAgePopulation: 0,
    outOfSchoolHeuristic: 0,
    seniorCitizens: 0,
    pwd: 0,
  },
  sectorRates: emptyRates,
  topIssues: [],
  serviceSignals: {
    totalRegisteredResidents: 0,
    indigencyRequests: 0,
    indigencyRequestRate: 0,
  },
};

const emptyLimitations: AnalyticsLimitations = {
  secretaryAvailability: "No staffing calendar exists in the system; the secretary's availability is not tracked.",
  requirementDelays: "No field records that a request is held up for missing requirements.",
  recurringTrend: "Recurrence requires prior snapshots; this indicates a single-point observation.",
};

export function emptyOverview(): AnalyticsOverview {
  return {
    totalRequests: 0,
    completedRequests: 0,
    completionRate: 0,
    statusCounts: {
      pending: 0,
      processing: 0,
      ready: 0,
      released: 0,
      cancelled: 0,
      rejected: 0,
      toClaim: 0,
      completed: 0,
    },
    pendingRequests: 0,
    processingRequests: 0,
    readyRequests: 0,
    rejectedRequests: 0,
    cancelledRequests: 0,
    revenueCollected: 0,
    pendingRevenue: 0,
    unpaidCount: 0,
    backlogCount: 0,
    overdueRequests: 0,
    oldestPendingAgeDays: null,
    averageProcessingTimeDays: null,
    processingTimeAvailable: false,
    weekOverWeekChange: 0,
    pendingVerificationCount: 0,
    rejectedPaymentCount: 0,
    counterPaymentCount: 0,
    blockedFromRelease: 0,
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    rejectedUsers: 0,
    growthRate: 0,
    topDocument: null,
    peakDay: null,
    peakHour: null,
  };
}

export function emptySummary(overrides?: Partial<AnalyticsSummary>): AnalyticsSummary {
  return {
    period: { from: null, to: null, label: "All time" },
    overview: emptyOverview(),
    community: emptyCommunity,
    trends: { userGrowth: [], engagementOverTime: [] },
    limitations: emptyLimitations,
    scoringVersion: "v2",
    ...overrides,
  };
}

export function stressedSummary(): AnalyticsSummary {
  const base = emptySummary();
  base.overview = {
    ...emptyOverview(),
    totalRequests: 120,
    completedRequests: 40,
    completionRate: 33,
    statusCounts: {
      pending: 30,
      processing: 25,
      ready: 28,
      released: 28,
      cancelled: 3,
      rejected: 1,
      toClaim: 0,
      completed: 5,
    },
    pendingRequests: 30,
    processingRequests: 25,
    readyRequests: 28,
    rejectedRequests: 1,
    cancelledRequests: 3,
    revenueCollected: 5600,
    pendingRevenue: 12000,
    unpaidCount: 55,
    backlogCount: 9,
    overdueRequests: 9,
    oldestPendingAgeDays: 6,
    averageProcessingTimeDays: 4.5,
    processingTimeAvailable: true,
    weekOverWeekChange: -38,
    pendingVerificationCount: 4,
    rejectedPaymentCount: 2,
    counterPaymentCount: 6,
    blockedFromRelease: 5,
    totalUsers: 900,
    activeUsers: 700,
    pendingUsers: 96,
    rejectedUsers: 12,
    growthRate: 4,
    topDocument: { name: "Barangay Clearance", count: 45, pct: 37.5 },
    peakDay: { name: "Monday", count: 30 },
    peakHour: { name: "09:00 – 10:00", count: 22 },
  };
  base.community = {
    ...base.community,
    totalResidents: 1000,
    sectorCounts: {
      workingAgePopulation: 600,
      unemployedHeuristic: 0,
      schoolAgePopulation: 300,
      outOfSchoolHeuristic: 0,
      seniorCitizens: 150,
      pwd: 0,
    },
    sectorRates: {
      ...emptyRates,
      seniorCitizenRate: 12.5,
      unemploymentRateHeuristic: 3,
    },
    topIssues: [
      {
        category: "Senior Citizens",
        problem: "Senior citizens need social support as a share of population",
        rate: 12.5,
        affectedCount: 150,
        severity: "HIGH",
        priorityScore: 72,
        recommendedProgram: "Senior citizen welfare programs",
      },
      {
        category: "Nutrition",
        problem: "Children in the barangay at risk of malnutrition",
        rate: 8,
        affectedCount: 30,
        severity: "MODERATE",
        priorityScore: 60,
        recommendedProgram: "Barangay Nutrition Action Program",
      },
    ],
  };
  return base;
}