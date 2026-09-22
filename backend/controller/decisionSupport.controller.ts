import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { DecisionSupportService } from "../services/decisionSupport.service";
import { AuditLogService } from "../services/auditLog.service";
import { isObjectId } from "../utils/validation";

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
      const { record, snapshotId } = await DecisionSupportService.generate(actor.name, actor.id);
      // Snapshot + analysis are logged (no PII: actor + ids + summary only).
      if (snapshotId) {
        await AuditLogService.create({
          actor: actor.name,
          actorId: actor.id,
          action: "Analytics Snapshot Created",
          entity: "analyticsSnapshot",
          entityId: snapshotId,
          entityLabel: "Analytics snapshot",
        }).catch(() => null);
      }
      await AuditLogService.create({
        actor: actor.name,
        actorId: actor.id,
        action: "Decision Support Generated",
        entity: "decisionSupport",
        entityId: record._id.toString(),
        entityLabel: record.summary || "Decision Support analysis",
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
}