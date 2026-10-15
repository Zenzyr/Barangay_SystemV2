jest.mock("../services/analyticsService", () => ({
  AnalyticsService: { getSummary: jest.fn() },
}));
jest.mock("../services/ai/aiInsightService", () => ({
  AIInsightService: { generateInsights: jest.fn() },
}));
jest.mock("../services/decisionSupport.service", () => ({
  DecisionSupportService: { generate: jest.fn() },
}));
jest.mock("../services/auditLog.service", () => ({
  AuditLogService: { create: jest.fn().mockResolvedValue(null) },
}));

import { parseDateRange } from "../utils/validation";
import { AnalyticsController } from "../controller/analytics.controller";
import { DecisionSupportController } from "../controller/decisionSupport.controller";
import { AnalyticsService } from "../services/analyticsService";
import { AIInsightService } from "../services/ai/aiInsightService";
import { DecisionSupportService } from "../services/decisionSupport.service";
import { emptySummary } from "./support/fixtures";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe("parseDateRange", () => {
  it("treats absent / empty bounds as 'all time'", () => {
    expect(parseDateRange({})).toEqual({ from: undefined, to: undefined });
    expect(parseDateRange({ from: "", to: null })).toEqual({ from: undefined, to: undefined });
  });

  it("accepts valid YYYY-MM-DD bounds", () => {
    expect(parseDateRange({ from: "2026-01-01", to: "2026-01-31" })).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("rejects malformed bounds with a labelled error", () => {
    expect(parseDateRange({ from: "01/01/2026" }).error).toMatch(/from/i);
    expect(parseDateRange({ to: "2026-13-40" }).error).toMatch(/to/i);
    expect(parseDateRange({ from: 123 as unknown as string }).error).toBeTruthy();
  });

  it("rejects a range whose from is after to", () => {
    expect(parseDateRange({ from: "2026-02-01", to: "2026-01-01" }).error).toMatch(/on or before/i);
  });
});

describe("AnalyticsController date range wiring", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s on an invalid range without computing a summary", async () => {
    const res = mockRes();
    await AnalyticsController.summary({ query: { from: "not-a-date" } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(AnalyticsService.getSummary).not.toHaveBeenCalled();
  });

  it("passes the parsed range through to getSummary", async () => {
    (AnalyticsService.getSummary as jest.Mock).mockResolvedValue(emptySummary());
    const res = mockRes();
    await AnalyticsController.summary(
      { query: { from: "2026-01-01", to: "2026-01-31" } } as any,
      res,
    );
    expect(AnalyticsService.getSummary).toHaveBeenCalledWith({ from: "2026-01-01", to: "2026-01-31" });
    expect(res.send).toHaveBeenCalled();
  });

  it("attaches the analysis period to the insights response", async () => {
    const summary = emptySummary();
    (AnalyticsService.getSummary as jest.Mock).mockResolvedValue(summary);
    (AIInsightService.generateInsights as jest.Mock).mockResolvedValue({
      provider: "rule-based",
      providerLabel: "Rule-based",
      connected: false,
      insights: [],
      recommendations: [],
    });
    const res = mockRes();
    await AnalyticsController.insights({ query: {} } as any, res);
    const payload = (res.send as jest.Mock).mock.calls[0][0];
    expect(payload.period).toEqual(summary.period);
    expect(AnalyticsService.getSummary).toHaveBeenCalledWith({ from: undefined, to: undefined });
  });
});

describe("DecisionSupportController date range wiring", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s on an invalid range before generating", async () => {
    const res = mockRes();
    await DecisionSupportController.generate(
      { body: { from: "2026-99-99" }, account: { name: "Sec", _id: { toString: () => "id1" } } } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(DecisionSupportService.generate).not.toHaveBeenCalled();
  });

  it("forwards the parsed range to DecisionSupportService.generate", async () => {
    (DecisionSupportService.generate as jest.Mock).mockResolvedValue({
      record: { _id: { toString: () => "abc" }, summary: "ok" },
      snapshotId: null,
    });
    const res = mockRes();
    await DecisionSupportController.generate(
      {
        body: { from: "2026-01-01", to: "2026-01-31" },
        account: { name: "Sec", _id: { toString: () => "id1" } },
      } as any,
      res,
    );
    expect(DecisionSupportService.generate).toHaveBeenCalledWith("Sec", "id1", {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
