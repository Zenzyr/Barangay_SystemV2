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

  /** An appeal that is still waiting on a decision. */
  static async getOpenByAccount(accountId: string) {
    return await SuspensionAppealModel.findOne({
      accountId,
      status: { $in: ["pending", "under_review"] },
    }).sort({ createdAt: -1 });
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
    // Conditional so a decided appeal can never be flipped a second time.
    return await SuspensionAppealModel.findOneAndUpdate(
      { _id: id, status: { $in: ["pending", "under_review"] } },
      {
        $set: {
          status,
          reviewedBy,
          reviewedAt: new Date(),
          ...(decisionNote !== undefined ? { decisionNote } : {}),
        },
      },
      { new: true }
    );
  }
}
