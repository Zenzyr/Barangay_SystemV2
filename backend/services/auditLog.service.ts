import AuditLogModel from "../model/auditLog.model";
import { auditLogInterfaceInput } from "../types/auditLog.type";

export class AuditLogService {
  static async create(data: auditLogInterfaceInput) {
    return await AuditLogModel.create(data);
  }

  static async getAll(filter: Record<string, any> = {}) {
    return await AuditLogModel.find(filter).sort({ createdAt: -1 });
  }
}