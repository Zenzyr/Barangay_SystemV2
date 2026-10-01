import SuspensionAppealModel from "../model/suspensionAppeal.model";
import { suspensionAppealInterfaceInput } from "../types/suspensionAppeal.type";

export class SuspensionAppealService {
  static async create(data: suspensionAppealInterfaceInput) {
    return await SuspensionAppealModel.create(data);
  }

  static async getAll(filter: Record<string, any> = {}) {
    return await SuspensionAppealModel.find(filter).sort({ createdAt: -1 });
  }

  static async getByAccount(accountId: string) {
    return await SuspensionAppealModel.find({ accountId }).sort({ createdAt: -1 });
  }

  static async get(id: string) {
    return await SuspensionAppealModel.findById(id);
  }

  static async updateStatus(
    id: string,
    status: "under_review" | "approved" | "rejected",
    reviewedBy: string,
    decisionNote?: string
  ) {
    return await SuspensionAppealModel.findByIdAndUpdate(
      id,
      {
        status,
        reviewedBy,
        reviewedAt: new Date(),
        ...(decisionNote !== undefined ? { decisionNote } : {}),
      },
      { new: true }
    );
  }
}
