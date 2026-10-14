import { AnalyticsSummary } from "../../types/analytics.type";
import {
  AIInsightOutput,
  AIInsightProvider,
  AIProviderInfo,
  InsightItem,
  InsightSeverity,
  RecommendationItem,
} from "../../types/ai.type";
import {
  getSeverity,
  getPriorityScore,
  priorityScoreOf,
  PriorityFactors,
} from "../../utils/analyticsRules";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const DELAY_THRESHOLD_DAYS = 3; // pending/processing older than this = backlog

interface DraftItem {
  category: string;
  title: string;
  why: string;
  action: string;
  severity: InsightSeverity;
  evidence?: string[];
  responsibleRole?: string;
  expectedOutcome?: string;
  timeframe?: string;
}

/**
 * Rule-based / heuristic AI provider operating ONLY on the normalized
 * AnalyticsSummary payload (never the database directly).
 *
 * It is deterministic, transparent, and privacy-safe (aggregate numbers only).
 * Every recommendation carries:
 *   - the exact numbers that triggered it (evidence),
 *   - a strict priority score computed by analyticsRules.getPriorityScore /
 *     priorityScoreOf (the model never sets its own score),
 *   - an owner role, expected outcome, and timeframe where meaningful.
 *
 * Recommendations are de-duplicated by category + title so the same underlying
 * issue never appears twice, and "No urgent action needed" is only emitted when
 * every tracked indicator is within its thresholds.
 */
export class RuleBasedAIProvider implements AIInsightProvider {
  readonly info: AIProviderInfo = {
    provider: "rule-based",
    providerLabel: "Rule-based logic",
    connected: false, // no external model call is made
  };

  async generateInsights(data: AnalyticsSummary): Promise<AIInsightOutput> {
    const { overview: o, community: c } = data;

    const insights: InsightItem[] = [];
    const recommendations: RecommendationItem[] = [];
    const seen = new Set<string>();

    const push = (
      items: (InsightItem | RecommendationItem)[],
      item: DraftItem,
      affectedCount: number,
      factors: PriorityFactors = {},
    ) => {
      const key = `${slug(item.category)}:${slug(item.title)}`;
      if (seen.has(key)) return; // one recommendation per underlying issue
      seen.add(key);
      const priorityScore = priorityScoreOf(item.severity, affectedCount, factors);
      items.push({
        id: slug(item.title),
        ...item,
        priorityScore,
        evidence: item.evidence ?? [],
        responsibleRole: item.responsibleRole,
        expectedOutcome: item.expectedOutcome,
        timeframe: item.timeframe,
      });
    };

    // ── 1. Request volume trend (compares this week to the previous week) ──
    if (o.weekOverWeekChange < -10) {
      push(insights, {
        category: "Requests",
        title: "Document request volume is down week-over-week",
        why: `Request volume fell ${Math.abs(o.weekOverWeekChange)}% this week versus last week, with ${o.totalRequests} total request(s) in the current window.`,
        action: "Run a re-engagement push: remind residents via SMS/notices that certificate requests (clearance, cedula, etc.) can be filed online.",
        severity: "warning",
        evidence: [`WoW change: ${o.weekOverWeekChange}%`, `Total requests: ${o.totalRequests}`],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "Restore request volume to the previous week's level or better.",
        timeframe: "This week",
      }, o.totalRequests, { worsening: true });
      push(recommendations, {
        category: "Requests",
        title: "Launch a re-engagement campaign",
        why: `A ${Math.abs(o.weekOverWeekChange)}% week-over-week drop suggests residents may have forgotten the service or hit friction applying online.`,
        action: "Schedule barangay announcements and reach out to households that previously requested certificates but have no recent activity.",
        severity: "warning",
        evidence: [`WoW change: ${o.weekOverWeekChange}%`],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "Reverse the volume decline and shorten any post-campaign processing queue.",
        timeframe: "This week",
      }, o.totalRequests, { worsening: true });
    } else if (o.weekOverWeekChange > 10) {
      push(insights, {
        category: "Requests",
        title: "Request volume is climbing",
        why: `Request volume was up ${o.weekOverWeekChange}% this week versus last week (${o.totalRequests} total request(s) in the window).`,
        action: "Prepare extra front-desk and processing capacity to absorb the increase and avoid backlogs.",
        severity: "info",
        evidence: [`WoW change: ${o.weekOverWeekChange}%`],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "Peak volume absorbed without creating new backlogs.",
        timeframe: "Before the next peak day",
      }, o.totalRequests, { worsening: false });
    }

    // ── 2. Backlog / overdue requests ────────────────────────────────
    if (o.backlogCount > 0) {
      const oldest = o.oldestPendingAgeDays != null ? `, oldest waiting ${o.oldestPendingAgeDays} day(s)` : "";
      push(insights, {
        category: "Requests",
        title: `${o.backlogCount} request(s) are past the ${DELAY_THRESHOLD_DAYS}-day processing target`,
        why: `${o.backlogCount} request(s) have been pending or in-processing for more than ${DELAY_THRESHOLD_DAYS} days${oldest}. This drives up resident wait times and completion-rate risk.`,
        action: "Open the Document Requests page and process the oldest pending/processing requests first, checking each for missing requirements or staffing bottlenecks.",
        severity: "warning",
        evidence: [`Backlog: ${o.backlogCount}`, `Oldest pending age: ${o.oldestPendingAgeDays ?? "n/a"} day(s)`],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "All backlogged requests move to ready/released within one week.",
        timeframe: "Within 3 days",
      }, o.backlogCount, { ageDays: o.oldestPendingAgeDays ?? DELAY_THRESHOLD_DAYS, blocksRelease: true, worsening: true });
      push(recommendations, {
        category: "Requests",
        title: "Clear the request backlog",
        why: `Long-running requests (${o.backlogCount}) increase wait times and the risk of never being completed.`,
        action: "Batch-update the oldest queued requests: verify details, collect payment, and issue documents in priority order. Reassign if staff capacity is the bottleneck.",
        severity: "warning",
        evidence: [`Backlog: ${o.backlogCount}`],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "Backlog cleared; average processing time returns to the normal range.",
        timeframe: "Within 3 days",
      }, o.backlogCount, { ageDays: o.oldestPendingAgeDays ?? DELAY_THRESHOLD_DAYS, blocksRelease: true });
    }

    // ── 3. Slow average processing time ──────────────────────────────
    if (o.processingTimeAvailable && o.averageProcessingTimeDays != null && o.averageProcessingTimeDays > DELAY_THRESHOLD_DAYS) {
      push(insights, {
        category: "Requests",
        title: `Average processing time is ${o.averageProcessingTimeDays} day(s)`,
        why: `Completed requests take an average of ${o.averageProcessingTimeDays} day(s) from creation to release, above the ${DELAY_THRESHOLD_DAYS}-day target.`,
        action: "Review where requests stall (pending → processing → ready → released) and fix the bottleneck stage — verify payment, staffing, or document generation.",
        severity: "warning",
        evidence: [`Avg processing: ${o.averageProcessingTimeDays} days`, "Target: ≤ 3 days"],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "Average processing time falls to 3 days or below.",
        timeframe: "Next 2 weeks",
      }, o.totalRequests, { ageDays: o.averageProcessingTimeDays, blocksRelease: true });
    }

    // ── 4. Completion rate ───────────────────────────────────────────-
    if (o.totalRequests >= 5 && o.completionRate < 50) {
      push(insights, {
        category: "Requests",
        title: `Low completion rate (${o.completionRate}%)`,
        why: `Only ${o.completionRate}% of ${o.totalRequests} requests reach completion, suggesting requests stall mid-pipeline.`,
        action: "Review where requests stall (pending → processing → to-claim) and fix the bottleneck stage.",
        severity: "warning",
        evidence: [`Completion rate: ${o.completionRate}%`, `Total requests: ${o.totalRequests}`],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "Completion rate rises above 50%.",
        timeframe: "Next 2 weeks",
      }, o.totalRequests, { blocksRelease: true, recurring: true });
    } else if (o.totalRequests >= 5 && o.completionRate >= 80) {
      push(insights, {
        category: "Requests",
        title: "Request pipeline running smoothly",
        why: `${o.completionRate}% of requests reach completion across the current window.`,
        action: "Keep current staffing and processing flow as-is.",
        severity: "positive",
        evidence: [`Completion rate: ${o.completionRate}%`],
        timeframe: "Ongoing",
      }, o.totalRequests);
    }

    // ── 5. Rejected / cancelled requests out of the normal range ────
    const rejectedCanceled = o.rejectedRequests + o.cancelledRequests;
    if (o.totalRequests >= 10 && rejectedCanceled / o.totalRequests > 0.25) {
      push(insights, {
        category: "Requests",
        title: `High share of rejected/cancelled requests (${Math.round((rejectedCanceled / o.totalRequests) * 100)}%)`,
        why: `${o.rejectedRequests} request(s) were rejected and ${o.cancelledRequests} were cancelled out of ${o.totalRequests}, suggesting avoidable inputs or churn.`,
        action: "Review rejected reasons and cancellations; simplify instructions and requirements on the request form where possible.",
        severity: "warning",
        evidence: [`Rejected: ${o.rejectedRequests}`, `Cancelled: ${o.cancelledRequests}`],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "Fewer than a quarter of requests end rejected or cancelled.",
        timeframe: "Next month",
      }, rejectedCanceled, { recurring: true });
    }

    // ── 6. Unpaid fees ───────────────────────────────────────────────
    if (o.unpaidCount > 0) {
      push(insights, {
        category: "Payments",
        title: "Outstanding document fees",
        why: `${o.unpaidCount} active request(s) are unpaid, representing approximately ₱${o.pendingRevenue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}.`,
        action: "Follow up with residents before releasing completed documents so revenue is collected.",
        severity: "warning",
        evidence: [`Unpaid: ${o.unpaidCount}`, `Pending revenue: ₱${o.pendingRevenue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`],
        responsibleRole: "Barangay Treasurer",
        expectedOutcome: "Outstanding fees collected before release; revenue fully accounted.",
        timeframe: "Before each release",
      }, o.unpaidCount, { paymentDelay: true, blocksRelease: true });
    }

    // ── 7. Payments awaiting verification ───────────────────────────
    if (o.pendingVerificationCount > 0) {
      push(recommendations, {
        category: "Payments",
        title: "Verify pending payment transactions",
        why: `${o.pendingVerificationCount} payment(s) are flagged as awaiting verification and cannot be released until confirmed.`,
        action: "Review the pending transactions against legitimate payment records and confirm each one before releasing its document.",
        severity: "warning",
        evidence: [`Pending verification: ${o.pendingVerificationCount}`],
        responsibleRole: "Barangay Treasurer",
        expectedOutcome: "Payments verified and documents released without holding revenue.",
        timeframe: "Within 1-2 days",
      }, o.pendingVerificationCount, { paymentDelay: true, blocksRelease: true, worsening: true });
    }

    // ── 8. Counter-payment requests awaiting treasurer attention ────
    if (o.counterPaymentCount > 0) {
      push(recommendations, {
        category: "Payments",
        title: "Treasurer: attend to counter-payment requests",
        why: `${o.counterPaymentCount} resident(s) signaled intent to pay in cash at the Barangay Hall. A counter-payment intent is NOT a confirmed payment — the fee is still outstanding.`,
        action: "Process these requests at the counter, record the cash payment, and issue the receipt before releasing each document.",
        severity: "warning",
        evidence: [`Counter-payment intents: ${o.counterPaymentCount}`],
        responsibleRole: "Barangay Treasurer",
        expectedOutcome: "All counter-payment requests converted to confirmed, receipted payments.",
        timeframe: "Within 3 days",
      }, o.counterPaymentCount, { paymentDelay: true, blocksRelease: true });
    }

    // ── 9. Requests blocked from release by unpaid fees ─────────────
    if (o.blockedFromRelease > 0) {
      push(insights, {
        category: "Payments",
        title: `${o.blockedFromRelease} finished request(s) blocked from release`,
        why: `${o.blockedFromRelease} request(s) are ready but not released because payment has not been confirmed.`,
        action: "Reconcile each ready-but-unpaid request with the resident or the treasurer before release.",
        severity: "warning",
        evidence: [`Blocked from release: ${o.blockedFromRelease}`],
        responsibleRole: "Barangay Treasurer",
        expectedOutcome: "Ready documents are released as soon as payment is confirmed.",
        timeframe: "Within 3 days",
      }, o.blockedFromRelease, { blocksRelease: true, paymentDelay: true });
    }

    // ── 10. Resident verification backlog ───────────────────────────
    if (o.pendingUsers > 0) {
      push(insights, {
        category: "Residents",
        title: `${o.pendingUsers} resident(s) await ID verification`,
        why: `${o.pendingUsers} registered account(s) are still pending approval and cannot request documents until verified.`,
        action: "Review pending registrations in Verify Resident to unlock them for document requests.",
        severity: "warning",
        evidence: [`Pending verifications: ${o.pendingUsers}`],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "Verification queue cleared; verified residents can request documents.",
        timeframe: "Within 3 days",
      }, o.pendingUsers, { worsening: true });
      push(recommendations, {
        category: "Residents",
        title: "Clear the ID verification queue",
        why: "Unverified residents cannot access barangay services, which directly caps demand and revenue.",
        action: "Process the pending verification list today and notify applicants of the outcome.",
        severity: "warning",
        evidence: [`Pending verifications: ${o.pendingUsers}`],
        responsibleRole: "Barangay Secretary",
        expectedOutcome: "All pending accounts resolved (approved or rejected-with-feedback).",
        timeframe: "Today",
      }, o.pendingUsers);
    }

    // ── 11. Top document + peak hours/days ──────────────────────────
    if (o.topDocument && o.topDocument.count > 0) {
      push(insights, {
        category: "Requests",
        title: `"${o.topDocument.name}" is the top request`,
        why: `${o.topDocument.name} accounts for ${o.topDocument.count} request(s) — ${o.topDocument.pct}% of the current window.`,
        action: "Keep this document's templates and requirements ready to speed up turnaround.",
        severity: "info",
        evidence: [`Top document: ${o.topDocument.name} (${o.topDocument.count})`, `Share: ${o.topDocument.pct}%`],
        timeframe: "Ongoing",
      }, o.topDocument.count);
    }
    if (o.peakDay) {
      push(insights, {
        category: "Requests",
        title: `Requests peak on ${o.peakDay.name}s`,
        why: `Historically, ${o.peakDay.count} request(s) come in on ${o.peakDay.name}s.`,
        action: "Plan front-desk coverage and supplies for the busiest day of the week.",
        severity: "info",
        evidence: [`Peak day: ${o.peakDay.name} (${o.peakDay.count})`],
        responsibleRole: "Barangay Secretary",
        timeframe: "Weekly",
      }, o.peakDay.count);
    }
    if (o.peakHour) {
      push(insights, {
        category: "Requests",
        title: `Peak request window is around ${o.peakHour.name}`,
        why: `${o.peakHour.count} request(s) cluster around ${o.peakHour.name}.`,
        action: "Align staff breaks and counter availability away from the peak window where possible.",
        severity: "info",
        evidence: [`Peak hour: ${o.peakHour.name} (${o.peakHour.count})`],
        responsibleRole: "Barangay Secretary",
        timeframe: "Weekly",
      }, o.peakHour.count);
    }

    // ── 12. Community sector signals ────────────────────────────────
    const sectorSignal = (rate: number, affectedCount: number, label: string, program: string, factors: PriorityFactors = {}) => {
      if (rate <= 5) return;
      const wcLevel = getSeverity(rate);
      const priorityScore = getPriorityScore(rate, wcLevel, affectedCount, factors);
      const title = `${label} rate elevated at ${rate}%`;
      const key = `${slug("Community")}:${slug(title)}`;
      if (seen.has(key)) return;
      seen.add(key);
      insights.push({
        id: slug(title),
        category: "Community",
        title,
        why: `Affects roughly ${affectedCount.toLocaleString()} resident(s); classified ${wcLevel} severity under the configured bands.`,
        action: `Consider activating "${program}" and review the exact rules in Recommendation Rules for threshold details.`,
        severity: "warning",
        evidence: [`Rate: ${rate}%`, `Affected: ${affectedCount}`, `Severity: ${wcLevel}`],
        priorityScore,
        responsibleRole: "Punong Barangay",
        expectedOutcome: `Residents in need gain access to ${program.toLowerCase()}.`,
        timeframe: "Next council session",
      });
      const recommendedTitle = program;
      const recKey = `program:${slug(recommendedTitle)}`;
      if (seen.has(recKey)) return;
      seen.add(recKey);
      recommendations.push({
        id: slug(recommendedTitle),
        category: "Community",
        title: recommendedTitle,
        why: `${label} (${rate}%) exceeds the normal range of 0-5%.`,
        action: `Coordinate with the barangay council and relevant agencies (DSWD, DOLE, TESDA) to implement ${program.toLowerCase()}.`,
        severity: "warning",
        evidence: [`Rate: ${rate}%`, `Affected: ${affectedCount}`],
        priorityScore,
        responsibleRole: "Punong Barangay",
        expectedOutcome: "A funded, scheduled program reaches the affected residents.",
        timeframe: "This quarter",
      });
    };

    sectorSignal(
      c.sectorRates.unemploymentRateHeuristic,
      c.sectorCounts.unemployedHeuristic,
      "Unemployment (heuristic)",
      "Livelihood & employment programs",
      { worsening: true }
    );
    sectorSignal(
      c.sectorRates.outOfSchoolRateHeuristic,
      c.sectorCounts.outOfSchoolHeuristic,
      "Out-of-school youth (heuristic)",
      "Education / ALS re-engagement program",
      { worsening: true }
    );
    sectorSignal(c.sectorRates.seniorCitizenRate, c.sectorCounts.seniorCitizens, "Senior citizen dependency", "Senior citizen welfare programs", { recurring: true });
    sectorSignal(c.sectorRates.pwdRate, c.sectorCounts.pwd, "PWD population", "PWD inclusion & accessibility programs", { recurring: true });

    // ── 13. Recommendation-rules engine output (echo) ───────────────
    for (const issue of c.topIssues) {
      const severity: InsightSeverity = issue.severity === "CRITICAL" || issue.severity === "HIGH" ? "warning" : "info";
      const key = `program:${slug(issue.recommendedProgram)}`;
      if (seen.has(key)) continue; // already surfaced as a community sector signal?
      seen.add(key);
      recommendations.push({
        id: slug(issue.recommendedProgram),
        category: issue.category,
        title: issue.recommendedProgram,
        why: `${issue.problem}: ${issue.rate}% of residents (${issue.affectedCount} people), priority score ${issue.priorityScore}/100.`,
        action: `${issue.recommendedProgram} — this already has an active rule in Recommendation Rules; assign ownership and a timeline.`,
        severity,
        evidence: [`Rate: ${issue.rate}%`, `Affected: ${issue.affectedCount}`, `Priority: ${issue.priorityScore}/100`],
        priorityScore: issue.priorityScore,
        responsibleRole: "Punong Barangay",
        expectedOutcome: "The named program moves from rule recommendation to an operating plan.",
        timeframe: "This quarter",
      });
    }

    // ── 14. Positive summary + healthy-state fallback ───────────────
    const positives: string[] = [];
    if (o.completionRate >= 80) positives.push(`high completion rate (${o.completionRate}%)`);
    if (o.weekOverWeekChange > 0 && o.weekOverWeekChange <= 10) positives.push(`healthy week-over-week growth (+${o.weekOverWeekChange}%)`);
    if (o.backlogCount === 0) positives.push("no backlogged requests past the 3-day target");
    if (o.pendingVerificationCount === 0 && o.pendingUsers === 0) positives.push("no verification queues");
    if (positives.length > 0) {
      push(insights, {
        category: "Overall",
        title: "Positive operational trends",
        why: `Tracked indicators that look good now: ${positives.join("; ")}.`,
        action: "Document these as the current baseline so future analyses can measure change.",
        severity: "positive",
        evidence: positives,
        timeframe: "Ongoing",
      }, o.totalRequests);
    }

    const hasWarnings = insights.some((i) => i.severity === "warning") || recommendations.some((r) => r.severity === "warning");
    if (!hasWarnings) {
      push(insights, {
        category: "Overall",
        title: "No urgent action needed right now",
        why: "All tracked indicators are within their configured thresholds in the current period.",
        action: "Carry on with the normal operating rhythm; revisit this page as new data comes in.",
        severity: "positive",
        timeframe: "Ongoing",
      }, firstNonNull(o.totalRequests, c.totalResidents, 0));
    }

    return { insights, recommendations, confidence: null };
  }
}

function firstNonNull(...values: number[]): number {
  for (const v of values) if (Number.isFinite(v) && v > 0) return v;
  return 0;
}