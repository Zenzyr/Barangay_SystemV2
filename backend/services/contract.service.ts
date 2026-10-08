import ContractModel from "../model/contract.model";
import { contractInterfaceInput } from "../types/contract.type";

export class ContractService {

  static async create(data: contractInterfaceInput) {
    return await ContractModel.create(data);
  }

  // Only the public party fields are projected so residents can never read the
  // counterparty's private data (ID images, reset hashes, suspension flags, ...).
  static async get(id: string) {
    return await ContractModel.findById(id)
      .populate("client", "name profile")
      .populate("provider", "name profile");
  }

  static async getByClient(clientId: string) {
    return await ContractModel.find({ client: clientId })
      .populate("provider", "name profile")
      .sort({ createdAt: -1 });
  }

  static async getByProvider(providerId: string) {
    return await ContractModel.find({ provider: providerId })
      .populate("client", "name profile")
      .sort({ createdAt: -1 });
  }

  static async requestCompletion(id: string) {
    return await ContractModel.findOneAndUpdate(
      { _id: id, status: "ACTIVE" },
      { status: "COMPLETION_REQUESTED", completionRequestedAt: new Date() },
      { new: true }
    );
  }

  static async confirmCompletion(id: string) {
    return await ContractModel.findOneAndUpdate(
      { _id: id, status: "COMPLETION_REQUESTED" },
      { status: "COMPLETED", completedAt: new Date() },
      { new: true }
    );
  }

  static async cancelIf(id: string) {
    return ContractModel.findOneAndUpdate(
      { _id: id, status: { $in: ["ACTIVE", "COMPLETION_REQUESTED"] } },
      { status: "CANCELLED", cancelledAt: new Date() },
      { new: true },
    );
  }

  static async syncStartDateByServiceRequest(serviceRequestId: string, startDate: string) {
    return ContractModel.findOneAndUpdate({ serviceRequest: serviceRequestId }, { startDate }, { new: true });
  }
}
