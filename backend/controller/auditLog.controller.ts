import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { AuditLogService } from "../services/auditLog.service";

export class AuditLogController {
  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { entity, limit } = request.query;
      const filter: Record<string, any> = {};
      if (entity) filter.entity = entity;
      const logs = await AuditLogService.getAll(filter);
      const sliced = limit ? logs.slice(0, Number(limit)) : logs;
      response.send(sliced);
    } catch (error: any) {
      console.error("[AUDIT GET ALL ERROR]", error);
      response.status(500).send("Failed to load audit logs");
    }
  };
}

export default AuditLogController;