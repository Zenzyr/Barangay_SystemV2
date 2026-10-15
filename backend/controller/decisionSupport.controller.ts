import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { DecisionSupportService } from "../services/decisionSupport.service";
import { DecisionSupportCalibrationService } from "../services/decisionSupportCalibration.service";
import { RecommendationFeedbackService } from "../services/recommendationFeedback.service";
import { AuditLogService } from "../services/auditLog.service";
import { AnalyticsSummary } from "../types/analytics.type";
import {
  FEEDBACK_STATUSES,
  MAX_FEEDBACK_NOTE_LENGTH,
  RecommendationFeedbackStatus,
} from "../types/recommendationFeedback.type";
import { isObjectId, parseDateRange, isNonEmptyString, withinLength } from "../utils/validation";

function actorOf(request: AuthRequest) {
  return {
    name: request.account?.name ?? "System",
    id: request.account?._id?.toString?.() ?? "",
  };
}

export class DecisionSupportController {

  /** GET /decision-support/latest — the most recent saved analysis (no generation). */
  static latest = async (request: AuthRequest, response: Response) => {
    try {
      const record = await DecisionSupportService.getLatest();
      if (!record) {
        response.status(404).json({ message: "No Decision Support analysis has been generated yet." });
        return;
      }
      response.send(record);
    } catch (error) {
      console.error("[DECISION SUPPORT LATEST ERROR]", error);
      response.status(500).send("Failed to fetch the latest decision support analysis");
    }
  };

  /** POST /decision-support/generate — explicit generation, only via this route. */
  static generate = async (request: AuthRequest, response: Response) => {
    try {
      const actor = actorOf(request);
      // Optional analysis window (YYYY-MM-DD). Absent = all time.
      const { from, to, error } = parseDateRange({
        from: request.body?.from,
        to: request.body?.to,
      });
      if (error) {
        response.status(400).json({ message: error });
        return;
      }
      const { record, snapshotId } = await DecisionSupportService.generate(actor.name, actor.id, { from, to });
      // Snapshot + analysis are logged (no PII: actor + ids + summary only).
      if (snapshotId) {
        await AuditLogService.create({
          actor: actor.name,
          actorId: actor.id,
          action: "create",
          entity: "analyticsSnapshot",
          entityId: snapshotId,
          entityLabel: "Analytics snapshot",
        }).catch(() => null);
      }
      await AuditLogService.create({
        actor: actor.name,
        actorId: actor.id,
        action: "create",
        entity: "decisionSupport",
        entityId: record._id.toString(),
        entityLabel: "Decision Support analysis",
        newValue: record.summary || "",
      }).catch(() => null);
      response.status(201).send(record);
    } catch (error) {
      console.error("[DECISION SUPPORT GENERATE ERROR]", error);
      response.status(500).json({
        message: "Failed to generate decision support analysis",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  /** GET /decision-support/history — previous saved analyses (no generation). */
  static history = async (request: AuthRequest, response: Response) => {
    try {
      const limitRaw = Number(request.query.limit);
      const records = await DecisionSupportService.getHistory(
        Number.isFinite(limitRaw) ? limitRaw : undefined,
      );
      response.send(records);
    } catch (error) {
      console.error("[DECISION SUPPORT HISTORY ERROR]", error);
      response.status(500).send("Failed to fetch decision support history");
    }
  };

  /** GET /decision-support/:id — one specific saved analysis (no generation). */
  static get = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid decision support id");
        return;
      }
      const record = await DecisionSupportService.get(id);
      if (!record) {
        response.status(404).send("Decision support analysis not found");
        return;
      }
      response.send(record);
    } catch (error) {
      console.error("[DECISION SUPPORT GET ERROR]", error);
      response.status(500).send("Failed to fetch decision support analysis");
    }
  };

  /** GET /decision-support/:id/calibration — saved snapshot vs live analytics. */
  static calibration = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid decision support id");
        return;
      }
      const record = await DecisionSupportService.get(id);
      if (!record) {
        response.status(404).send("Decision support analysis not found");
        return;
      }
      const result = await DecisionSupportCalibrationService.compare(
        (record.dataSnapshot || {}) as AnalyticsSummary,
      );
      response.send(result);
    } catch (error) {
      console.error("[DECISION SUPPORT CALIBRATION ERROR]", error);
      response.status(500).send("Failed to compute outcome calibration");
    }
  };

  /** GET /decision-support/:id/feedback — staff feedback for one saved analysis. */
  static feedback = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid decision support id");
        return;
      }
      const rows = await RecommendationFeedbackService.listByAnalysis(id);
      response.send(rows);
    } catch (error) {
      console.error("[DECISION SUPPORT FEEDBACK LIST ERROR]", error);
      response.status(500).send("Failed to fetch recommendation feedback");
    }
  };

  /** PUT /decision-support/:id/feedback — record/update feedback for a recommendation. */
  static saveFeedback = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid decision support id");
        return;
      }

      const { recommendationId, status, note, category, title } = request.body ?? {};
      if (!isNonEmptyString(recommendationId)) {
        response.status(400).json({ message: "recommendationId is required" });
        return;
      }
      if (!isNonEmptyString(status) || !(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
        response.status(400).json({
          message: `status must be one of: ${FEEDBACK_STATUSES.join(", ")}`,
        });
        return;
      }
      if (note !== undefined && !withinLength(String(note), MAX_FEEDBACK_NOTE_LENGTH)) {
        response.status(400).json({ message: "note is too long" });
        return;
      }

      const record = await DecisionSupportService.get(id);
      if (!record) {
        response.status(404).send("Decision support analysis not found");
        return;
      }

      const actor = actorOf(request);
      const saved = await RecommendationFeedbackService.upsert(
        id,
        {
          recommendationId: String(recommendationId),
          status: status as RecommendationFeedbackStatus,
          note: note !== undefined ? String(note) : "",
        },
        actor,
        {
          category: isNonEmptyString(category) ? String(category) : undefined,
          title: isNonEmptyString(title) ? String(title) : undefined,
        },
      );

      await AuditLogService.create({
        actor: actor.name,
        actorId: actor.id,
        action: "update",
        entity: "recommendationFeedback",
        entityId: saved._id.toString(),
        entityLabel: `Recommendation feedback (${status})`,
        newValue: saved.title || saved.recommendationId,
      }).catch(() => null);

      response.status(200).send(saved);
    } catch (error) {
      console.error("[DECISION SUPPORT FEEDBACK SAVE ERROR]", error);
      response.status(500).send("Failed to save recommendation feedback");
    }
  };

  /** GET /decision-support/feedback/summary — feedback counts across analyses. */
  static feedbackSummary = async (_request: AuthRequest, response: Response) => {
    try {
      const summary = await RecommendationFeedbackService.statusSummary();
      response.send(summary);
    } catch (error) {
      console.error("[DECISION SUPPORT FEEDBACK SUMMARY ERROR]", error);
      response.status(500).send("Failed to compute feedback summary");
    }
  };
}