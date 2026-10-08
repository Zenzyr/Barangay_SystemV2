import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { AuditLogService } from "../services/auditLog.service";

export class AuditLogController {
  /** Hard ceiling so one request can never pull the whole collection. */
  static MAX_LIMIT = 5000;

  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { entity, action, actorId, from, to, limit } = request.query;
      const filter: Record<string, any> = {};
      if (entity) filter.entity = entity;
      if (action) filter.action = action;
      if (actorId) filter.actorId = actorId;
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(String(from));
        if (to) filter.createdAt.$lte = new Date(String(to));
      }

      const requested = Number(limit);
      const resolvedLimit =
        Number.isFinite(requested) && requested > 0
          ? Math.min(requested, AuditLogController.MAX_LIMIT)
          : AuditLogController.MAX_LIMIT;

      const logs = await AuditLogService.getAll(filter, { limit: resolvedLimit });
      response.send(logs);
    } catch (error: any) {
      console.error("[AUDIT GET ALL ERROR]", error);
      response.status(500).send("Failed to load audit logs");
    }
  };
}

export default AuditLogController;