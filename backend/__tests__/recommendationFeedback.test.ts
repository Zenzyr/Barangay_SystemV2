jest.mock("../services/decisionSupport.service", () => ({
  DecisionSupportService: { get: jest.fn(), getLatest: jest.fn(), generate: jest.fn() },
}));
jest.mock("../services/recommendationFeedback.service", () => ({
  RecommendationFeedbackService: {
    upsert: jest.fn(),
    listByAnalysis: jest.fn(),
    statusSummary: jest.fn(),
  },
}));
jest.mock("../services/decisionSupportCalibration.service", () => ({
  DecisionSupportCalibrationService: { compare: jest.fn() },
}));
jest.mock("../services/auditLog.service", () => ({
  AuditLogService: { create: jest.fn().mockResolvedValue(null) },
}));

import { DecisionSupportController } from "../controller/decisionSupport.controller";
import { DecisionSupportService } from "../services/decisionSupport.service";
import { RecommendationFeedbackService } from "../services/recommendationFeedback.service";
import { DecisionSupportCalibrationService } from "../services/decisionSupportCalibration.service";
import { AuditLogService } from "../services/auditLog.service";

const VALID_ID = "507f1f77bcf86cd799439011";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

const account = { name: "Secretary", _id: { toString: () => "acct-1" } };

describe("DecisionSupportController.saveFeedback", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s on an invalid analysis id", async () => {
    const res = mockRes();
    await DecisionSupportController.saveFeedback(
      { params: { id: "not-an-id" }, body: {}, account } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(RecommendationFeedbackService.upsert).not.toHaveBeenCalled();
  });

  it("400s when recommendationId is missing", async () => {
    const res = mockRes();
    await DecisionSupportController.saveFeedback(
      { params: { id: VALID_ID }, body: { status: "applied" }, account } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(RecommendationFeedbackService.upsert).not.toHaveBeenCalled();
  });

  it("400s on an unknown status", async () => {
    const res = mockRes();
    await DecisionSupportController.saveFeedback(
      {
        params: { id: VALID_ID },
        body: { recommendationId: "rec-1", status: "nonsense" },
        account,
      } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(RecommendationFeedbackService.upsert).not.toHaveBeenCalled();
  });

  it("400s when the note is too long", async () => {
    const res = mockRes();
    await DecisionSupportController.saveFeedback(
      {
        params: { id: VALID_ID },
        body: { recommendationId: "rec-1", status: "applied", note: "x".repeat(5000) },
        account,
      } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(RecommendationFeedbackService.upsert).not.toHaveBeenCalled();
  });

  it("404s when the analysis does not exist", async () => {
    (DecisionSupportService.get as jest.Mock).mockResolvedValue(null);
    const res = mockRes();
    await DecisionSupportController.saveFeedback(
      {
        params: { id: VALID_ID },
        body: { recommendationId: "rec-1", status: "applied" },
        account,
      } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(RecommendationFeedbackService.upsert).not.toHaveBeenCalled();
  });

  it("upserts feedback, logs it, and returns the saved row", async () => {
    (DecisionSupportService.get as jest.Mock).mockResolvedValue({ _id: VALID_ID });
    const saved = {
      _id: "fb-1",
      recommendationId: "rec-1",
      title: "Clear the backlog",
      status: "applied",
    };
    (RecommendationFeedbackService.upsert as jest.Mock).mockResolvedValue(saved);

    const res = mockRes();
    await DecisionSupportController.saveFeedback(
      {
        params: { id: VALID_ID },
        body: { recommendationId: "rec-1", status: "applied", note: "Done", title: "Clear the backlog" },
        account,
      } as any,
      res,
    );

    expect(RecommendationFeedbackService.upsert).toHaveBeenCalledWith(
      VALID_ID,
      { recommendationId: "rec-1", status: "applied", note: "Done" },
      { name: "Secretary", id: "acct-1" },
      { category: undefined, title: "Clear the backlog" },
    );
    expect(AuditLogService.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(saved);
  });
});

describe("DecisionSupportController.feedback / feedbackSummary / calibration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists feedback for an analysis", async () => {
    (RecommendationFeedbackService.listByAnalysis as jest.Mock).mockResolvedValue([{ _id: "fb-1" }]);
    const res = mockRes();
    await DecisionSupportController.feedback({ params: { id: VALID_ID }, account } as any, res);
    expect(RecommendationFeedbackService.listByAnalysis).toHaveBeenCalledWith(VALID_ID);
    expect(res.send).toHaveBeenCalledWith([{ _id: "fb-1" }]);
  });

  it("returns the feedback status summary", async () => {
    (RecommendationFeedbackService.statusSummary as jest.Mock).mockResolvedValue({
      acknowledged: 1,
      applied: 2,
      dismissed: 0,
      resolved: 3,
    });
    const res = mockRes();
    await DecisionSupportController.feedbackSummary({ account } as any, res);
    expect(res.send).toHaveBeenCalledWith({
      acknowledged: 1,
      applied: 2,
      dismissed: 0,
      resolved: 3,
    });
  });

  it("400s calibration on an invalid id", async () => {
    const res = mockRes();
    await DecisionSupportController.calibration({ params: { id: "x" }, account } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(DecisionSupportCalibrationService.compare).not.toHaveBeenCalled();
  });

  it("404s calibration when the analysis is missing", async () => {
    (DecisionSupportService.get as jest.Mock).mockResolvedValue(null);
    const res = mockRes();
    await DecisionSupportController.calibration({ params: { id: VALID_ID }, account } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("compares the saved snapshot to live analytics", async () => {
    const snapshot = { period: { from: null, to: null, label: "All time" }, overview: {} };
    (DecisionSupportService.get as jest.Mock).mockResolvedValue({ _id: VALID_ID, dataSnapshot: snapshot });
    (DecisionSupportCalibrationService.compare as jest.Mock).mockResolvedValue({
      period: snapshot.period,
      rows: [],
      summary: { resolved: 0, improved: 0, unchanged: 0, worsened: 0, unknown: 0 },
    });
    const res = mockRes();
    await DecisionSupportController.calibration({ params: { id: VALID_ID }, account } as any, res);
    expect(DecisionSupportCalibrationService.compare).toHaveBeenCalledWith(snapshot);
    expect(res.send).toHaveBeenCalled();
  });
});
