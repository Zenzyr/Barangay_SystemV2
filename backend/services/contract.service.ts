import ContractModel from "../model/contract.model";
import { contractInterfaceInput } from "../types/contract.type";

export class ContractService {

  static async create(data: contractInterfaceInput) {
    return await ContractModel.create(data);
  }

  static async get(id: string) {
    return await ContractModel.findById(id)
      .populate("client", "-password")
      .populate("provider", "-password");
  }

  static async getByClient(clientId: string) {
    return await ContractModel.find({ client: clientId })
      .populate("provider", "-password")
      .sort({ createdAt: -1 });
  }

  static async getByProvider(providerId: string) {
    return await ContractModel.find({ provider: providerId })
      .populate("client", "-password")
      .sort({ createdAt: -1 });
  }

  static async requestCompletion(id: string) {
    return await ContractModel.findByIdAndUpdate(
      id,
      { status: "COMPLETION_REQUESTED", completionRequestedAt: new Date() },
      { new: true }
    );
  }

  static async confirmCompletion(id: string) {
    return await ContractModel.findByIdAndUpdate(
      id,
      { status: "COMPLETED", completedAt: new Date() },
      { new: true }
    );
  }

  static async cancel(id: string) {
    return await ContractModel.findByIdAndUpdate(id, { status: "CANCELLED" }, { new: true });
  }

  static async countActiveByProvider(providerId: string) {
    return await ContractModel.countDocuments({
      provider: providerId,
      status: { $in: ["ACTIVE", "COMPLETION_REQUESTED"] },
    });
  }
}
