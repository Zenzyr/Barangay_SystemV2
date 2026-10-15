import mongoose from "mongoose";
import DocumentRequestModel from "../model/documentRequest.model";
import AccountModel from "../model/account.model";
import { AnalyticsService } from "../services/analyticsService";
import { SCORING_VERSION } from "../utils/analyticsRules";

const DAY = 86_400_000;
const oidAt = (ms: number) => mongoose.Types.ObjectId.createFromTime(Math.floor(ms / 1000));

describe("AnalyticsService.getSummary", () => {
  beforeEach(async () => {
    await DocumentRequestModel.deleteMany({});
    await AccountModel.deleteMany({});
  });

  it("computes operational, payment and verification indicators from documents", async () => {
    const now = Date.now();
    const d = (daysAgo: number) => now - daysAgo * DAY;

    await AccountModel.create([
      { name: "Active One", email: "a1@test.com", password: "x", status: "approved", role: "resident" },
      { name: "Pending One", email: "a2@test.com", password: "x", status: "pending", role: "resident" },
      { name: "Old Active", email: "a3@test.com", password: "x", status: "approved", role: "resident" },
    ]);
    // Note: only a1/a2 fall inside the 30-day growth window (a3 is 40 days old).

    await DocumentRequestModel.create([
      { _id: oidAt(d(5)), document: "certificateOfGoodMoralCharacter", status: "pending", price: 100, isPaid: false, requestTime: "09:00" },
      { _id: oidAt(d(6)), document: "barangayCertificate", status: "processing", price: 150, isPaid: false, requestTime: "10:00" },
      { _id: oidAt(d(2)), document: "certificateOfResidency", status: "ready", price: 50, isPaid: false, counterPaymentIntent: true },
      {
        _id: oidAt(d(10)),
        document: "endorsementLetter",
        status: "released",
        price: 200,
        isPaid: true,
        statusHistory: [
          { status: "pending", at: new Date(oidAt(d(10)).getTimestamp().getTime()) },
          { status: "released", at: new Date(oidAt(d(10)).getTimestamp().getTime() + 2 * DAY) },
        ],
      },
      { _id: oidAt(d(4)), document: "barangayCertification", status: "cancelled", price: 25, isPaid: false },
      { _id: oidAt(d(1)), document: "certificateOfIndigency", status: "ready", price: 30, isPaid: false, paymentVerificationStatus: "pending" },
    ]);

    const summary = await AnalyticsService.getSummary();
    const o = summary.overview;

    expect(summary.scoringVersion).toBe(SCORING_VERSION);
    expect(summary.limitations.secretaryAvailability).toContain("not tracked");

    // Request volume & pipeline
    expect(o.totalRequests).toBe(6);
    expect(o.completedRequests).toBe(1);
    expect(o.completionRate).toBe(17);
    expect(o.statusCounts).toEqual({
      pending: 1, processing: 1, ready: 2, released: 1, cancelled: 1, rejected: 0, toClaim: 0, completed: 0,
    });
    expect(o.rejectedRequests).toBe(0);
    expect(o.cancelledRequests).toBe(1);

    // Backlog & processing time
    expect(o.backlogCount).toBe(2);
    expect(o.overdueRequests).toBe(2);
    expect(o.oldestPendingAgeDays).toBe(6);
    expect(o.averageProcessingTimeDays).toBe(2);
    expect(o.processingTimeAvailable).toBe(true);

    // Money
    expect(o.revenueCollected).toBe(200);
    expect(o.unpaidCount).toBe(5);
    expect(o.pendingRevenue).toBe(355);

    // Payments & releases
    expect(o.pendingVerificationCount).toBe(1);
    expect(o.rejectedPaymentCount).toBe(0);
    expect(o.counterPaymentCount).toBe(1);
    expect(o.blockedFromRelease).toBe(2);

    // Accounts (the 40-day-old account is outside the growth window →
    // current period has 2 registrations vs 0 before → +100%)
    expect(o.totalUsers).toBe(3);
    expect(o.activeUsers).toBe(2);
    expect(o.pendingUsers).toBe(1);
    expect(o.rejectedUsers).toBe(0);
    expect(o.growthRate).toBe(100);

    expect(o.topDocument).not.toBeNull();
    expect(o.peakDay).not.toBeNull();
    expect(o.peakHour).not.toBeNull();
  });

  it("applies a from/to range to requests + accounts and reports the period", async () => {
    const now = Date.now();
    const d = (daysAgo: number) => now - daysAgo * DAY;
    // Local YYYY-MM-DD so the assertion is timezone-independent.
    const localDate = (ms: number) => {
      const dt = new Date(ms);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };

    await DocumentRequestModel.create([
      { _id: oidAt(d(1)), document: "barangayCertificate", status: "pending", price: 10, isPaid: false },
      { _id: oidAt(d(5)), document: "barangayCertificate", status: "pending", price: 10, isPaid: false },
      { _id: oidAt(d(20)), document: "barangayCertificate", status: "pending", price: 10, isPaid: false },
      { _id: oidAt(d(40)), document: "barangayCertificate", status: "pending", price: 10, isPaid: false },
    ]);

    // Last 10 days -> only the 1- and 5-day-old requests.
    const fromOnly = await AnalyticsService.getSummary({ from: localDate(d(10)) });
    expect(fromOnly.overview.totalRequests).toBe(2);
    expect(fromOnly.period.from).toBe(localDate(d(10)));
    expect(fromOnly.period.to).toBeNull();
    expect(fromOnly.period.label).toMatch(/^Last \d+ day\(s\)$/);

    // A bounded window (20 days ago -> 2 days ago) excludes the newest and oldest.
    const bounded = await AnalyticsService.getSummary({
      from: localDate(d(20)),
      to: localDate(d(2)),
    });
    expect(bounded.overview.totalRequests).toBe(2); // the 5- and 20-day-old requests
    expect(bounded.period.from).toBe(localDate(d(20)));
    expect(bounded.period.to).toBe(localDate(d(2)));
    expect(bounded.period.label).toBe(`${localDate(d(20))} to ${localDate(d(2))}`);

    // "Up to" bound only -> excludes anything newer than the cutoff.
    const toOnly = await AnalyticsService.getSummary({ to: localDate(d(3)) });
    expect(toOnly.overview.totalRequests).toBe(3); // 5-, 20- and 40-day-old requests
    expect(toOnly.period.from).toBeNull();
    expect(toOnly.period.label).toBe(`Up to ${localDate(d(3))}`);
  });

  it("treats a single-day range (from === to) as that whole day, inclusive", async () => {
    const now = Date.now();
    const d = (daysAgo: number) => now - daysAgo * DAY;
    const localDate = (ms: number) => {
      const dt = new Date(ms);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    };

    await DocumentRequestModel.create([
      { _id: oidAt(d(1)), document: "barangayCertificate", status: "pending", price: 10, isPaid: false },
      { _id: oidAt(d(5)), document: "barangayCertificate", status: "pending", price: 10, isPaid: false },
      // A minute later, same calendar day → distinct _id, same day boundary.
      { _id: oidAt(d(5) + 60_000), document: "barangayCertification", status: "pending", price: 10, isPaid: false },
    ]);

    const day = localDate(d(5));
    const summary = await AnalyticsService.getSummary({ from: day, to: day });
    // Only the two requests created on that exact day are counted.
    expect(summary.overview.totalRequests).toBe(2);
    expect(summary.period.from).toBe(day);
    expect(summary.period.to).toBe(day);
  });

  it("handles a previous week with zero requests as +100% instead of dividing by zero", async () => {
    const now = Date.now();
    const d = (daysAgo: number) => now - daysAgo * DAY;

    await DocumentRequestModel.create([
      { _id: oidAt(d(2)), document: "soloCertification", status: "released", price: 10, isPaid: true },
    ]);

    const summary = await AnalyticsService.getSummary();

    expect(summary.overview.weekOverWeekChange).toBe(100);
    expect(summary.overview.backlogCount).toBe(0);
    expect(summary.overview.unpaidCount).toBe(0);
    expect(summary.overview.processingTimeAvailable).toBe(false); // no status history to measure
  });
});