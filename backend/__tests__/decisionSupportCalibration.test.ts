jest.mock("../services/analyticsService", () => ({
  AnalyticsService: { getSummary: jest.fn() },
}));

import { DecisionSupportCalibrationService } from "../services/decisionSupportCalibration.service";
import { AnalyticsService } from "../services/analyticsService";
import { emptySummary, stressedSummary } from "./support/fixtures";
import type { AnalyticsSummary } from "../types/analytics.type";

function snapshotFrom(summary: AnalyticsSummary): AnalyticsSummary {
  // A saved snapshot is a frozen plain object; clone so tests never alias.
  return JSON.parse(JSON.stringify(summary)) as AnalyticsSummary;
}

describe("DecisionSupportCalibrationService.compare", () => {
  beforeEach(() => jest.clearAllMocks());

  it("only reports metrics that were captured in the snapshot", async () => {
    const snapshot = emptySummary();
    // Strip community so its rates must be skipped (never invented).
    const partial = { ...snapshotFrom(snapshot), community: undefined } as unknown as AnalyticsSummary;
    (AnalyticsService.getSummary as jest.Mock).mockResolvedValue(stressedSummary());

    const result = await DecisionSupportCalibrationService.compare(partial);
    const keys = result.rows.map((r) => r.key);
    expect(keys).toContain("backlogCount");
    expect(keys).not.toContain("seniorCitizenRate");
  });

  it("classifies improvements, resolutions and regressions against live data", async () => {
    const baseline = stressedSummary();
    baseline.overview = { ...baseline.overview, backlogCount: 9 };
    const snapshot = snapshotFrom(baseline);

    // Live numbers: backlog cleared to 0, more unpaid fees, completion rate up.
    const live = stressedSummary();
    live.overview = {
      ...live.overview,
      backlogCount: 0,
      unpaidCount: 70,
      completionRate: 50,
    };
    (AnalyticsService.getSummary as jest.Mock).mockResolvedValue(live);

    const result = await DecisionSupportCalibrationService.compare(snapshot);
    const byKey = Object.fromEntries(result.rows.map((r) => [r.key, r]));

    expect(byKey.backlogCount.outcome).toBe("resolved");
    expect(byKey.unpaidCount.outcome).toBe("worsened");
    expect(byKey.completionRate.outcome).toBe("improved");
    expect(result.summary.resolved).toBeGreaterThanOrEqual(1);
    expect(result.summary.worsened).toBeGreaterThanOrEqual(1);
  });

  it("counts every row into exactly one summary bucket", async () => {
    (AnalyticsService.getSummary as jest.Mock).mockResolvedValue(stressedSummary());
    const result = await DecisionSupportCalibrationService.compare(snapshotFrom(stressedSummary()));
    const total = Object.values(result.summary).reduce((a, b) => a + b, 0);
    expect(total).toBe(result.rows.length);
  });

  it("returns an empty report when the snapshot has no analyzable metrics", async () => {
    (AnalyticsService.getSummary as jest.Mock).mockResolvedValue(emptySummary());
    const result = await DecisionSupportCalibrationService.compare({} as AnalyticsSummary);
    expect(result.rows).toHaveLength(0);
  });
});
