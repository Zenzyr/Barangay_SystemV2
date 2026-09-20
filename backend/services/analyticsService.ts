import DocumentRequestModel from "../model/documentRequest.model";
import AccountModel from "../model/account.model";
import { CommunityAnalyticsService } from "./communityAnalyticsService";
import { RecommendationService } from "./recommendationService";
import { safeRate } from "../utils/analyticsRules";
import {
  AnalyticsSummary,
  AnalyticsOverview,
  AnalyticsCommunity,
  AnalyticsTrends,
  AnalyticsSummaryQuery,
  CommunitySectorCounts,
} from "../types/analytics.type";

// ─── Constants (mirrors the frontend analytics page) ──────────────
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Clearance",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker: "Barangay Certification (First-Time Jobseeker)",
  certificateOfLowIncome: "Certificate of Low Income",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ)",
  endorsementLetter: "Endorsement Letter",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ──────────────────────────────────────────────────────
export function dateFromObjectId(id: string): Date {
  const timestamp = parseInt(String(id).substring(0, 8), 16) * 1000;
  return new Date(timestamp);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Single source of truth for analytics. Aggregates the general system
 * analytics (document requests + accounts) and the community analytics
 * (resident census) into one normalized payload consumed by both the
 * Unified Analytics page and the AI insight layer.
 */
export class AnalyticsService {
  static async getSummary(query: AnalyticsSummaryQuery = {}): Promise<AnalyticsSummary> {
    const now = new Date();
    const from = query.from ? startOfDay(new Date(query.from)) : null;
    const to = query.to ? startOfDay(new Date(query.to)) : null;

    const [rawDocs, rawAccounts, community, employment, education, seniors, pwd, youth, social, health, topIssues] =
      await Promise.all([
        DocumentRequestModel.find({ isArchived: { $ne: true } }),
        AccountModel.find(),
        CommunityAnalyticsService.getOverview(),
        CommunityAnalyticsService.getEmploymentSector(),
        CommunityAnalyticsService.getEducationSector(),
        CommunityAnalyticsService.getSeniorSector(),
        CommunityAnalyticsService.getPwdSector(),
        CommunityAnalyticsService.getYouthSector(),
        CommunityAnalyticsService.getSocialWelfareSector(),
        CommunityAnalyticsService.getHealthSector(),
        RecommendationService.generateRecommendations(),
      ]);

    const inRange = (date: Date): boolean => {
      if (from && date.getTime() < from.getTime()) return false;
      if (to && date.getTime() > startOfDay(new Date(to.getTime() + 86_400_000)).getTime()) return false;
      return true;
    };

    const docs = (rawDocs || []).filter((d: any) => inRange(dateFromObjectId(d._id)));
    const accounts = (rawAccounts || []).filter((a: any) => inRange(dateFromObjectId(a._id)));

    const overview = AnalyticsService.computeOverview(docs, accounts, rawAccounts, now, from);
    const communitySummary = AnalyticsService.computeCommunity(
      community,
      employment,
      education,
      seniors,
      pwd,
      youth,
      social,
      health,
      topIssues,
      docs,
      accounts
    );
    const trends = AnalyticsService.computeTrends(docs, accounts, now);

    const periodLabel =
      !from ? "All time" : `Last ${Math.max(1, Math.round((now.getTime() - from.getTime()) / 86_400_000))} day(s)`;

    return {
      period: {
        from: from ? from.toISOString().slice(0, 10) : null,
        to: to ? to.toISOString().slice(0, 10) : null,
        label: periodLabel,
      },
      overview,
      community: communitySummary,
      trends,
    };
  }

  // ── General (system) analytics ───────────────────────────────────
  private static computeOverview(
    docs: any[],
    accounts: any[],
    rawAccounts: any[],
    now: Date,
    from: Date | null
  ): AnalyticsOverview {
    const completed = docs.filter((d) => d.status === "completed").length;
    const completionRate = docs.length > 0 ? Math.round((completed / docs.length) * 100) : 0;

    const revenueCollected = docs
      .filter((d) => d.isPaid)
      .reduce((sum, d) => sum + (Number(d.price) || 0), 0);
    const activeDocs = docs.filter((d) => !d.isPaid && d.status !== "completed");
    const pendingRevenue = activeDocs.reduce((sum, d) => sum + (Number(d.price) || 0), 0);
    const unpaidCount = activeDocs.length;

    const totalUsers = accounts.length;
    const activeUsers = accounts.filter((a) => a.status === "approved").length;
    const pendingUsers = accounts.filter((a) => a.status === "pending").length;
    const rejectedUsers = accounts.filter((a) => a.status === "rejected").length;

    // Growth: registrations this window vs the previous window of equal length.
    const currentStart = from ? startOfDay(from) : startOfDay(new Date(now.getTime() - 30 * 86_400_000));
    const windowMs = now.getTime() - currentStart.getTime();
    const prevStart = new Date(currentStart.getTime() - windowMs);
    const countBetween = (list: any[], a: Date, b: Date) =>
      list.filter((el) => {
        const t = dateFromObjectId(el._id).getTime();
        return t >= a.getTime() && t < b.getTime();
      }).length;
    const currentRegistrations = countBetween(rawAccounts, currentStart, now);
    const prevRegistrations = countBetween(rawAccounts, prevStart, currentStart);
    const growthRate =
      prevRegistrations > 0
        ? Math.round(((currentRegistrations - prevRegistrations) / prevRegistrations) * 100)
        : currentRegistrations > 0
          ? 100
          : 0;

    // Week-over-week request volume.
    const thisWeekStart = new Date(now.getTime() - 7 * 86_400_000);
    const lastWeekStart = new Date(now.getTime() - 14 * 86_400_000);
    let thisWeek = 0;
    let lastWeek = 0;
    docs.forEach((d) => {
      const t = dateFromObjectId(d._id);
      if (t >= thisWeekStart && t <= now) thisWeek++;
      else if (t >= lastWeekStart && t < thisWeekStart) lastWeek++;
    });
    const weekOverWeekChange =
      lastWeek > 0
        ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
        : thisWeek > 0
          ? 100
          : 0;

    // Backlog: pending/processing older than 3 days.
    const threshold = new Date(now.getTime() - 3 * 86_400_000);
    const backlogCount = docs.filter(
      (d) => (d.status === "pending" || d.status === "processing") && dateFromObjectId(d._id) < threshold
    ).length;

    // Most requested document.
    const docCounts: Record<string, number> = {};
    docs.forEach((d) => {
      docCounts[d.document] = (docCounts[d.document] || 0) + 1;
    });
    const topEntry = Object.entries(docCounts)
      .map(([doc, count]) => ({
        name: DOCUMENT_NAMES[doc] || doc,
        count,
        pct: docs.length > 0 ? Math.round((count / docs.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)[0];

    // Peak day of week.
    const weekdayCounts = new Array(7).fill(0);
    docs.forEach((d) => {
      weekdayCounts[dateFromObjectId(d._id).getDay()]++;
    });
    let peakDay: { name: string; count: number } | null = null;
    weekdayCounts.forEach((count, i) => {
      if (count > 0 && (!peakDay || count > peakDay.count)) peakDay = { name: WEEKDAYS[i], count };
    });

    return {
      totalRequests: docs.length,
      completedRequests: completed,
      completionRate,
      revenueCollected,
      pendingRevenue,
      unpaidCount,
      backlogCount,
      weekOverWeekChange,
      totalUsers,
      activeUsers,
      pendingUsers,
      rejectedUsers,
      growthRate,
      topDocument: topEntry || null,
      peakDay,
    };
  }

  // ── Community analytics ──────────────────────────────────────────
  private static computeCommunity(
    community: any,
    employment: any,
    education: any,
    seniors: any,
    pwd: any,
    youth: any,
    social: any,
    health: any,
    topIssues: any[],
    docs: any[],
    accounts: any[]
  ): AnalyticsCommunity {
    const sectorCounts: CommunitySectorCounts = {
      workingAgePopulation: employment.workingAgePopulation,
      unemployedHeuristic: employment.unemployedHeuristic,
      schoolAgePopulation: education.schoolAgePopulation,
      outOfSchoolHeuristic: education.outOfSchoolHeuristic,
      seniorCitizens: seniors.seniorCitizens,
      pwd: pwd.pwd,
    };

    const indigency = docs.filter((d) => d.document === "certificateOfIndigency");

    return {
      totalResidents: community.totalResidents,
      totalHouseholds: community.totalHouseholds,
      children: community.children,
      youth: youth.youthPopulation,
      sectorCounts,
      sectorRates: {
        unemploymentRateHeuristic: employment.unemploymentRateHeuristic,
        outOfSchoolRateHeuristic: education.outOfSchoolRateHeuristic,
        seniorCitizenRate: seniors.seniorCitizenRate,
        pwdRate: pwd.pwdRate,
        youthRate: youth.youthRate,
        fourPsRate: social.fourPsRate,
        soloParentRate: social.soloParentRate,
        hpnMaintenanceRate: health.hpnMaintenanceRate,
        familyPlanningRate: social.familyPlanningRate,
      },
      topIssues: (topIssues || []).map((r) => ({
        category: r.category,
        problem: r.problem,
        rate: r.rate,
        affectedCount: r.affectedCount,
        severity: r.severity,
        priorityScore: r.priorityScore,
        recommendedProgram: r.recommendedProgram,
      })),
      serviceSignals: {
        totalRegisteredResidents: accounts.length,
        indigencyRequests: indigency.length,
        indigencyRequestRate: safeRate(indigency.length, accounts.length),
      },
    };
  }

  // ── Trends ───────────────────────────────────────────────────────
  private static computeTrends(docs: any[], accounts: any[], now: Date): AnalyticsTrends {
    // Resident registrations per week (last 8 weeks).
    const userGrowth: AnalyticsTrends["userGrowth"] = [];
    const weekMap = new Map<string, number>();
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now.getTime() - i * 7 * 86_400_000);
      const label = start.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      weekMap.set(`w${i}`, 0);
      userGrowth.push({ label, count: 0 });
    }
    accounts.forEach((a) => {
      const diffWeeks = Math.floor((now.getTime() - dateFromObjectId(a._id).getTime()) / (7 * 86_400_000));
      const idx = 7 - diffWeeks;
      if (idx >= 0 && idx < userGrowth.length) userGrowth[idx].count++;
    });

    // Document requests per day (last 14 days).
    const engagementOverTime: AnalyticsTrends["engagementOverTime"] = [];
    const dayMap = new Map<string, { label: string; count: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      const point = { label, count: 0 };
      dayMap.set(key, point);
      engagementOverTime.push(point);
    }
    docs.forEach((d) => {
      const key = dateFromObjectId(d._id).toISOString().slice(0, 10);
      const point = dayMap.get(key);
      if (point) point.count++;
    });

    return { userGrowth, engagementOverTime };
  }
}