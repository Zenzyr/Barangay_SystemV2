import AuditLogModel from "../model/auditLog.model";
import { auditLogInterfaceInput } from "../types/auditLog.type";

export class AuditLogService {
  static async create(data: auditLogInterfaceInput) {
    try {
      return await AuditLogModel.create(data);
    } catch (error) {
      // Never swallow silently: a rejected audit write must be visible in logs.
      console.error(
        "[AUDIT WRITE FAILED]",
        JSON.stringify({ action: data.action, entity: data.entity, entityId: data.entityId }),
        error
      );
      return null;
    }
  }

  static async getAll(
    filter: Record<string, any> = {},
    options: { limit?: number } = {}
  ) {
    let query = AuditLogModel.find(filter).sort({ createdAt: -1 });
    if (options.limit && options.limit > 0) query = query.limit(options.limit);
    return await query;
  }
}