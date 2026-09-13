import { AnalyticsSummary } from "../../types/analytics.type";
import {
  AIInsightOutput,
  AIInsightProvider,
  AIProviderInfo,
  InsightItem,
  InsightSeverity,
} from "../../types/ai.type";
import { getSeverity } from "../../utils/analyticsRules";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

interface DraftItem {
  category: string;
  title: string;
  why: string;
  action: string;
  severity: InsightSeverity;
}

/**
 * Mock / rule-based provider. Implements simple threshold logic on top of the
 * AnalyticsSummary payload (e.g. "engagement dropped >10% -> suggest a
 * re-engagement campaign"). No external calls are made.
 *
 * Replaced transparently by a real LLM provider (see aiProviders.ts + the
 * AI_PROVIDER env flag) without touching the UI or the analytics service.
 */
export class RuleBasedAIProvider implements AIInsightProvider {
  readonly info: AIProviderInfo = {
    provider: "rule-based",
    providerLabel: "Rule-based logic (mock)",
    connected: false,
  };

  async generateInsights(data: AnalyticsSummary): Promise<AIInsightOutput> {
    const { overview: o, community: c } = data;

    const insights: InsightItem[] = [];
    const recommendations: InsightItem[] = [];

    const push = (items: InsightItem[], item: DraftItem) => {
      items.push({ id: slug(item.title), ...item });
    };

    // ── Request volume trend ─────────────────────────────────────
    if (o.weekOverWeekChange < -10) {
      push(insights, {
        category: "Requests",
        title: "Document request volume is down",
        why: `Request volume fell ${Math.abs(o.weekOverWeekChange)}% this week compared to last week while there are ${o.totalRequests} requests in total.`,
        action: "Run a re-engagement push: remind residents via SMS/notices that certificate requests (clearance, cedula, etc.) can be filed online.",
        severity: "warning",
      });
      push(recommendations, {
        category: "Requests",
        title: "Launch a re-engagement campaign",
        why: `A ${Math.abs(o.weekOverWeekChange)}% week-over-week drop suggests residents may have forgotten or hit friction in requesting documents.`,
        action: "Schedule barangay announcements and reach out to households that previously requested certificates but have no recent activity.",
        severity: "warning",
      });
    } else if (o.weekOverWeekChange > 10) {
      push(insights, {
        category: "Requests",
        title: "Request volume is climbing",
        why: `Request volume is up ${o.weekOverWeekChange}% this week versus last week (${o.totalRequests} total requests in the current window).`,
        action: "Prepare extra front-desk and processing capacity to absorb the increased volume and avoid backlogs.",
        severity: "info",
      });
    }

    // ── Backlog ───────────────────────────────────────────────────
    if (o.backlogCount > 0) {
      push(insights, {
        category: "Requests",
        title: `${o.backlogCount} request(s) are waiting 3+ days`,
        why: `${o.backlogCount} request(s) have been pending or in-processing for more than 3 days, longer than the typical handling time.`,
        action: "Open the Document Requests page and process the oldest pending/processing requests first.",
        severity: "warning",
      });
      push(recommendations, {
        category: "Requests",
        title: "Clear the request backlog",
        why: "Long-running requests increase resident wait times and completion-rate risk.",
        action: "Batch-update the oldest queued requests: verify details, collect payment, and issue documents in priority order.",
        severity: "warning",
      });
    }

    // ── Unpaid fees ───────────────────────────────────────────────
    if (o.unpaidCount > 0) {
      push(insights, {
        category: "Payments",
        title: "Outstanding document fees",
        why: `${o.unpaidCount} active request(s) are unpaid, representing approximately ₱${o.pendingRevenue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}.`,
        action: "Follow up with residents before releasing completed documents so revenue is collected.",
        severity: "warning",
      });
    }

    // ── Resident verification backlog ────────────────────────────
    if (o.pendingUsers > 0) {
      push(insights, {
        category: "Residents",
        title: `${o.pendingUsers} resident(s) await ID verification`,
        why: `${o.pendingUsers} registered account(s) are still pending approval and cannot request documents until verified.`,
        action: "Review pending registrations in Verify Resident to unlock them for document requests.",
        severity: "warning",
      });
      push(recommendations, {
        category: "Residents",
        title: "Clear the ID verification queue",
        why: "Unverified residents cannot access barangay services, which directly caps demand and revenue.",
        action: "Process the pending verification list today and notify applicants of the outcome.",
        severity: "warning",
      });
    }

    // ── Completion rate ──────────────────────────────────────────
    if (o.totalRequests >= 5 && o.completionRate < 50) {
      push(insights, {
        category: "Requests",
        title: `Low completion rate (${o.completionRate}%)`,
        why: `Only ${o.completionRate}% of ${o.totalRequests} requests reach completion, suggesting requests stall mid-pipeline.`,
        action: "Review where requests stall (pending → processing → to-claim) and fix the bottleneck stage.",
        severity: "warning",
      });
    } else if (o.totalRequests >= 5 && o.completionRate >= 80) {
      push(insights, {
        category: "Requests",
        title: "Request pipeline running smoothly",
        why: `${o.completionRate}% of requests reach completion across the current window.`,
        action: "Keep current staffing and processing flow as-is.",
        severity: "positive",
      });
    }

    // ── Top document + peak day ──────────────────────────────────
    if (o.topDocument && o.topDocument.count > 0) {
      push(insights, {
        category: "Requests",
        title: `"${o.topDocument.name}" is the top request`,
        why: `${o.topDocument.name} accounts for ${o.topDocument.count} request(s) — ${o.topDocument.pct}% of the current window.`,
        action: "Keep this document's templates and requirements ready to speed up turnaround.",
        severity: "info",
      });
    }
    if (o.peakDay) {
      push(insights, {
        category: "Requests",
        title: `Requests peak on ${o.peakDay.name}s`,
        why: `Historically, ${o.peakDay.count} request(s) come in on ${o.peakDay.name}s.`,
        action: "Plan front-desk coverage and supplies for the busiest day of the week.",
        severity: "info",
      });
    }

    // ── Community sector signals ──────────────────────────────────
    const sectorSignal = (rate: number, affectedCount: number, label: string, program: string) => {
      if (rate <= 5) return;
      const wcLevel = getSeverity(rate);
      const severity: InsightSeverity = "warning";
      push(insights, {
        category: "Community",
        title: `${label} rate elevated at ${rate}%`,
        why: `Affects roughly ${affectedCount.toLocaleString()} resident(s); classified ${wcLevel} severity under the configured bands.`,
        action: `Consider activating "${program}" and review the exact rules in Recommendation Rules for threshold details.`,
        severity,
      });
      push(recommendations, {
        category: "Community",
        title: program,
        why: `${label} (${rate}%) exceeds the normal range of 0-5%.`,
        action: `Coordinate with the barangay council and relevant agencies (DSWD, DOLE, TESDA) to implement ${program.toLowerCase()}.`,
        severity,
      });
    };

    sectorSignal(
      c.sectorRates.unemploymentRateHeuristic,
      c.sectorCounts.unemployedHeuristic,
      "Unemployment (heuristic)",
      "Livelihood & employment programs"
    );
    sectorSignal(
      c.sectorRates.outOfSchoolRateHeuristic,
      c.sectorCounts.outOfSchoolHeuristic,
      "Out-of-school youth (heuristic)",
      "Education / ALS re-engagement program"
    );
    sectorSignal(c.sectorRates.seniorCitizenRate, c.sectorCounts.seniorCitizens, "Senior citizen dependency", "Senior citizen welfare programs");
    sectorSignal(c.sectorRates.pwdRate, c.sectorCounts.pwd, "PWD population", "PWD inclusion & accessibility programs");

    // ── Recommendation-rules engine output (echo) ────────────────
    for (const issue of c.topIssues) {
      const severity: InsightSeverity = issue.severity === "CRITICAL" || issue.severity === "HIGH" ? "warning" : "info";
      push(recommendations, {
        category: issue.category,
        title: issue.recommendedProgram,
        why: `${issue.problem}: ${issue.rate}% of residents (${issue.affectedCount} people), priority score ${issue.priorityScore}/100.`,
        action: `${issue.recommendedProgram} — this already has an active rule in Recommendation Rules; assign ownership and a timeline.`,
        severity,
      });
    }

    // ── Everything looks healthy ──────────────────────────────────
    if (!insights.some((i) => i.severity === "warning")) {
      push(insights, {
        category: "Overall",
        title: "No urgent action needed right now",
        why: "All tracked indicators are within their configured thresholds in the current window.",
        action: "Carry on with the normal operating rhythm; revisit this page as new data comes in.",
        severity: "positive",
      });
    }

    return { insights, recommendations, confidence: null };
  }
}